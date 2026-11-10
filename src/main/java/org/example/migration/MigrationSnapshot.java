package org.example.migration;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.sql.*;
import java.util.*;
import java.util.stream.*;

/** Offline H2/local-media snapshots. Never overwrites a restore destination. */
public final class MigrationSnapshot {
    static final ObjectMapper JSON=new ObjectMapper().configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS,true)
        .enable(com.fasterxml.jackson.core.JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
        .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    private MigrationSnapshot() {}
    static IllegalArgumentException refused(String text) { return new IllegalArgumentException(text); }
    static String hash(byte[] bytes) {
        try { byte[] digest=MessageDigest.getInstance("SHA-256").digest(bytes); StringBuilder result=new StringBuilder(); for(byte b:digest) result.append(String.format("%02x",b&255)); return result.toString(); }
        catch(Exception ex) {throw new IllegalStateException("Checksum indisponível.",ex);}
    }
    public static String fileHash(Path path) throws IOException {
        try(InputStream stream=Files.newInputStream(path)) {
            MessageDigest digest;
            try {digest=MessageDigest.getInstance("SHA-256");}catch(Exception ex){throw new IllegalStateException(ex);}
            byte[] buffer=new byte[65536]; int count; while((count=stream.read(buffer))!=-1) digest.update(buffer,0,count);
            StringBuilder value=new StringBuilder(); for(byte b:digest.digest())value.append(String.format("%02x",b&255)); return value.toString();
        }
    }
    static String quote(String identifier) {return "\""+identifier.replace("\"","\"\"")+"\"";}
    static String literal(Path path) {return "'"+path.toAbsolutePath().toString().replace("'","''")+"'";}
    static List<Map<String,Object>> rows(Connection db,String sql,Object... args) throws SQLException,IOException {
        List<Map<String,Object>> result=new ArrayList<>();
        try(PreparedStatement query=db.prepareStatement(sql)) {
            for(int i=0;i<args.length;i++)query.setObject(i+1,args[i]);
            try(ResultSet rs=query.executeQuery()) {
                ResultSetMetaData meta=rs.getMetaData();
                while(rs.next()) {
                    Map<String,Object> row=new TreeMap<>();
                    for(int i=1;i<=meta.getColumnCount();i++) {
                        Object value=rs.getObject(i);
                        if(value instanceof Clob) {Clob clob=(Clob)value; value=clob.getSubString(1,Math.toIntExact(clob.length()));}
                        else if(value instanceof Blob) {Blob blob=(Blob)value; value=Base64.getEncoder().encodeToString(blob.getBytes(1,Math.toIntExact(blob.length())));}
                        else if(value instanceof byte[]) value=Base64.getEncoder().encodeToString((byte[])value);
                        else if(value!=null) value=value.toString();
                        row.put(meta.getColumnLabel(i).toUpperCase(Locale.ROOT),value);
                    }
                    result.add(row);
                }
            }
        }
        result.sort(Comparator.comparing(row -> {try{return JSON.writeValueAsString(row);}catch(Exception ex){throw new IllegalStateException(ex);}}));
        return result;
    }
    static Set<String> tables(Connection db) throws SQLException {
        Set<String> result=new TreeSet<>();
        try(ResultSet rs=db.getMetaData().getTables(null,"PUBLIC","%",null)) {
            while(rs.next()) {String type=rs.getString("TABLE_TYPE"); if("TABLE".equals(type)||"BASE TABLE".equals(type))result.add(rs.getString("TABLE_NAME").toUpperCase(Locale.ROOT));}
        }
        return result;
    }
    static Set<String> columns(Connection db,String table) throws SQLException {
        Set<String> result=new TreeSet<>(); try(ResultSet rs=db.getMetaData().getColumns(null,"PUBLIC",table,"%")){while(rs.next())result.add(rs.getString("COLUMN_NAME").toUpperCase(Locale.ROOT));}return result;
    }
    static String databaseHash(Connection db) throws Exception {
        Map<String,Object> data=new TreeMap<>(); for(String table:tables(db))data.put(table,rows(db,"select * from "+quote(table))); return hash(JSON.writeValueAsBytes(data));
    }
    static Path root(Path directory) throws IOException {
        Path path=directory.toAbsolutePath().normalize();
        if(!Files.isDirectory(path,LinkOption.NOFOLLOW_LINKS)||Files.isSymbolicLink(path))throw refused("Raiz de media inválida.");
        return path.toRealPath();
    }
    static Path safeFile(Path media,String stored) throws IOException {
        Path base=root(media), path=Paths.get(stored); path=(path.isAbsolute()?path:base.resolve(path)).toAbsolutePath().normalize();
        if(!path.startsWith(base))throw refused("Media fora da raiz aprovada.");
        Path current=base; for(Path part:base.relativize(path)){current=current.resolve(part);if(Files.isSymbolicLink(current))throw refused("Symlink de media recusado.");}
        if(!Files.isRegularFile(path,LinkOption.NOFOLLOW_LINKS))throw refused("Media referenciado ausente.");
        return path;
    }
    static SortedMap<String,String> mediaHashes(Path media) throws IOException {
        Path base=root(media); SortedMap<String,String> result=new TreeMap<>();
        try(Stream<Path> stream=Files.walk(base)) {
            for(Path p:stream.collect(Collectors.toList())) {
                if(Files.isSymbolicLink(p))throw refused("Symlink no backup de media recusado.");
                if(Files.isRegularFile(p,LinkOption.NOFOLLOW_LINKS))result.put(base.relativize(p).toString().replace('\\','/'),fileHash(p));
            }
        }
        return result;
    }
    static Path newDirectory(Path target) throws IOException {
        Path absolute=target.toAbsolutePath().normalize();
        if(absolute.toString().contains(";")||absolute.toString().chars().anyMatch(Character::isISOControl))throw refused("Destino de operação inválido.");
        if(Files.exists(absolute,LinkOption.NOFOLLOW_LINKS))throw refused("O destino tem de ser novo; não será substituído.");
        for(Path p=absolute.getParent();p!=null;p=p.getParent())if(Files.isSymbolicLink(p))throw refused("Destino com symlink recusado.");
        Files.createDirectories(absolute); return absolute;
    }
    static void writeNew(Path file,JsonNode value) throws IOException {Files.write(file,JSON.writerWithDefaultPrettyPrinter().writeValueAsBytes(value),StandardOpenOption.CREATE_NEW);}
    static byte[] readBytes(Path file) throws IOException {
        if(Files.isSymbolicLink(file)||!Files.isRegularFile(file,LinkOption.NOFOLLOW_LINKS)||Files.size(file)>4*1024*1024)throw refused("Documento de operação inválido.");
        byte[] bytes=Files.readAllBytes(file);if(bytes.length>4*1024*1024)throw refused("Documento de operação demasiado grande.");return bytes;
    }
    static JsonNode read(Path file) throws IOException {return JSON.readTree(readBytes(file));}
    public static ObjectNode backup(Connection db,Path media,Path output) throws Exception {
        requireH2(db); Path base=root(media), out=output.toAbsolutePath().normalize();
        if(out.startsWith(base)||base.startsWith(out))throw refused("Backup não pode conter nem ficar dentro da raiz de media.");
        Map<String,String> files=mediaHashes(base); String fingerprint=databaseHash(db);
        ObjectNode contextDigests=JSON.createObjectNode();for(JsonNode ctx:LegacyCrewMigrationTool.plan(db,base).path("contexts"))contextDigests.put(ctx.path("teamProfileId").asText(),ctx.path("digest").asText());
        out=newDirectory(out);
        Path copy=Files.createDirectory(out.resolve("media"));
        for(String relative:files.keySet()) {
            Path source=safeFile(base,relative), target=copy.resolve(relative).normalize(); Files.createDirectories(target.getParent()); Files.copy(source,target);
            if(!files.get(relative).equals(fileHash(target)))throw refused("Media mudou durante o backup.");
        }
        try(Statement statement=db.createStatement()){statement.execute("SCRIPT TO "+literal(out.resolve("database.sql")));}
        if(!fingerprint.equals(databaseHash(db))||!files.equals(mediaHashes(base)))throw refused("Origem mudou durante o backup; não usar este backup.");
        ObjectNode result=JSON.createObjectNode(); result.put("version",1); result.put("databaseFingerprint",fingerprint); result.put("sqlDigest",fileHash(out.resolve("database.sql"))); result.put("originalMediaRoot",base.toString()); result.set("files",JSON.valueToTree(files));
        result.set("contextDigests",contextDigests);
        writeNew(out.resolve("backup.json"),result); return result;
    }
    static final class CheckedBackup {
        final JsonNode metadata; final String digest;
        CheckedBackup(JsonNode metadata,String digest){this.metadata=metadata;this.digest=digest;}
    }
    static CheckedBackup validateBackup(Path backup) throws Exception {
        Path base=root(backup);byte[] bytes=readBytes(base.resolve("backup.json"));JsonNode manifest=JSON.readTree(bytes);
        if(manifest.path("version").asInt()!=1 || !manifest.path("files").isObject() || !manifest.path("sqlDigest").asText().equals(fileHash(safeFile(base,"database.sql"))))throw refused("Backup inválido ou adulterado.");
        Map<String,String> actual=mediaHashes(base.resolve("media"));
        if(!JSON.valueToTree(actual).equals(manifest.get("files")))throw refused("Media do backup divergente.");
        return new CheckedBackup(manifest,hash(bytes));
    }
    public static ObjectNode restoreCheck(Path backup,Path output,String user,String password) throws Exception {
        CheckedBackup checked=validateBackup(backup);JsonNode manifest=checked.metadata;Path out=newDirectory(output);
        Path media=Files.createDirectory(out.resolve("media"));
        Iterator<String> names=manifest.path("files").fieldNames(); while(names.hasNext()) {
            String relative=names.next(); Path source=safeFile(backup.resolve("media"),relative),target=media.resolve(relative).normalize();
            if(!target.startsWith(media))throw refused("Caminho de restauro inválido."); Files.createDirectories(target.getParent()); Files.copy(source,target);
        }
        String url="jdbc:h2:file:"+out.resolve("restored").toString()+";DB_CLOSE_ON_EXIT=FALSE";
        Path sql=Files.copy(safeFile(backup,"database.sql"),out.resolve("database.sql"));
        if(!manifest.path("sqlDigest").asText().equals(fileHash(sql)))throw refused("SQL mudou durante a cópia de restauro.");
        try(Connection db=DriverManager.getConnection(url,user,password);Statement statement=db.createStatement()) {
            statement.execute("RUNSCRIPT FROM "+literal(sql));
            if(!manifest.path("databaseFingerprint").asText().equals(databaseHash(db)))throw refused("Base restaurada diverge do backup.");
            LegacyCrewMigrationTool.verifyRestoredContexts(db,media,manifest);
        }
        if(!manifest.path("files").equals(JSON.valueToTree(mediaHashes(media))))throw refused("Media restaurado divergente.");
        ObjectNode proof=JSON.createObjectNode(); proof.put("version",1); proof.put("verified",true); proof.put("backupDigest",checked.digest); proof.put("databaseFingerprint",manifest.path("databaseFingerprint").asText());
        writeNew(out.resolve("restore-proof.json"),proof); return proof;
    }
    static void requireH2(Connection db) throws SQLException {if(!"H2".equals(db.getMetaData().getDatabaseProductName()))throw refused("Esta versão só ensaia H2 local; alvo não suportado.");}
}
