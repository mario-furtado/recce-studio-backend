package org.example.migration;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import java.util.jar.JarFile;
import static org.example.migration.MigrationSnapshot.*;

/** Explicit offline operator tool. Does not bootstrap Spring or run startup backfills. */
public final class LegacyCrewMigrationTool {
    public static final String CAPABILITY="crew-compat-v1";
    private LegacyCrewMigrationTool() {}
    static void requireSchema(Connection db) throws Exception {
        requireH2(db);
        for(String table:Arrays.asList("AUTH_USERS","TEAM_PROFILE","RALLIES","PECS","NOTES","TEAM_CARS","OFFLINE_RECCE_SYNCS"))
            if(!tables(db).contains(table))throw refused("Schema legado incompleto; preparar compatibilidade antes de continuar.");
        for(String table:Arrays.asList("AUTH_USERS","RALLIES","TEAM_CARS","OFFLINE_RECCE_SYNCS"))
            if(!columns(db,table).contains("TEAM_PROFILE_ID"))throw refused("Schema sem vínculo de contexto; não inferir propriedade.");
    }
    static String text(Object value) {return value==null?null:value.toString();}
    static long count(Connection db,String sql,Object... args) throws Exception {return Long.parseLong(text(rows(db,sql,args).get(0).values().iterator().next()));}
    static ObjectNode context(Connection db,Path media,String team) throws Exception {
        return context(db,media,root(media),team);
    }
    static ObjectNode context(Connection db,Path media,Path originalMedia,String team) throws Exception {
        Map<String,Object> data=new TreeMap<>(); Set<String> available=tables(db); List<String> reasons=new ArrayList<>();
        List<Map<String,Object>> profile=rows(db,"select * from team_profile where id=?",team);
        if(profile.size()!=1)throw refused("Equipa do manifesto não encontrada.");
        boolean managed="true".equalsIgnoreCase(text(profile.get(0).get("MANAGED_CREW")));
        profile.get(0).remove("MANAGED_CREW"); data.put("TEAM_PROFILE",profile);
        List<Map<String,Object>> members=rows(db,"select * from auth_users where team_profile_id=?",team);
        List<String> accountIds=new ArrayList<>(); for(Map<String,Object> member:members){accountIds.add(text(member.get("ID")));member.remove("LEGACY_CREW_MIGRATED");}
        Collections.sort(accountIds); data.put("AUTH_USERS",members);
        if(members.size()!=1)reasons.add("OWNER_OR_MEMBERS_UNRESOLVED");
        else if(!"true".equalsIgnoreCase(text(members.get(0).get("ACTIVE"))))reasons.add("OWNER_INACTIVE");
        boolean converted=available.contains("LEGACY_CREW_MIGRATIONS") && count(db,"select count(*) from legacy_crew_migrations where team_profile_id=?",team)>0;
        if(managed&&!converted)reasons.add("NOT_A_LEGACY_CONTEXT");
        if(!converted&&available.contains("CREWS")&&count(db,"select count(*) from crews where id=?",team)>0)reasons.add("CREW_ID_ALREADY_EXISTS");
        for(String table:available) {
            if(Arrays.asList("AUTH_USERS","TEAM_PROFILE","CREWS","LEGACY_CREW_MIGRATIONS","LEGACY_CREW_MIGRATION_LOCK","LEGACY_AUTH_CONTEXTS").contains(table))continue;
            Set<String> cols=columns(db,table); String predicate=null;
            if(cols.contains("TEAM_PROFILE_ID")) {
                predicate="team_profile_id=?";
                if(cols.contains("PEC_ID"))predicate="("+predicate+" or pec_id in (select p.id from pecs p join rallies r on p.rally_id=r.id where r.team_profile_id=?))";
            } else if(cols.contains("RALLY_ID"))predicate="rally_id in (select id from rallies where team_profile_id=?)";
            else if(cols.contains("PEC_ID"))predicate="pec_id in (select p.id from pecs p join rallies r on p.rally_id=r.id where r.team_profile_id=?)";
            if(predicate!=null) {
                List<Map<String,Object>> selected=rows(db,"select * from "+quote(table)+" where "+predicate,predicate.contains(" or ")?new Object[]{team,team}:new Object[]{team});
                data.put(table,selected);
                if(table.equals("OFFLINE_RECCE_SYNCS"))for(Map<String,Object> row:selected)if(!team.equals(text(row.get("TEAM_PROFILE_ID"))))reasons.add("SYNC_BINDING_UNRESOLVED");
            }
        }
        if(columns(db,"RALLIES").contains("CAR_ID"))for(Map<String,Object> rally:rows(db,"select * from rallies where team_profile_id=?",team)) {
            String car=text(rally.get("CAR_ID"));
            if(car!=null&&!car.isEmpty()&&count(db,"select count(*) from team_cars where id=? and team_profile_id=?",car,team)!=1)reasons.add("CAR_BINDING_UNRESOLVED");
        }
        Map<String,String> files=new TreeMap<>();
        for(Object records:data.values())for(Object record:(List<?>)records)for(Map.Entry<?,?> value:((Map<?,?>)record).entrySet()) {
            if(value.getKey().toString().endsWith("_STORAGE_PATH") && value.getValue()!=null && !value.getValue().toString().isEmpty()) {
                try {
                    Path stored=Paths.get(value.getValue().toString()).normalize();
                    if(stored.isAbsolute()) {
                        if(!stored.startsWith(originalMedia))throw refused("Media fora da raiz original.");
                        stored=originalMedia.relativize(stored);
                    }
                    Path file=safeFile(media,stored.toString());files.put(root(media).relativize(file).toString().replace('\\','/'),fileHash(file));
                }
                catch(Exception ex){reasons.add("MEDIA_MISSING_OR_UNSAFE");}
            }
        }
        Map<String,Object> project=new TreeMap<>(data);project.remove("AUTH_USERS"); project.put("MEDIA",files);
        String projectDigest=hash(JSON.writeValueAsBytes(project)); data.put("MEDIA",files);
        ObjectNode result=JSON.createObjectNode(); result.put("teamProfileId",team); result.put("digest",hash(JSON.writeValueAsBytes(data)));result.put("projectDigest",projectDigest);
        result.set("candidateAccountIds",JSON.valueToTree(accountIds)); result.set("blockingReasons",JSON.valueToTree(new TreeSet<>(reasons)));result.put("converted",converted);
        ObjectNode counts=result.putObject("counts");for(Map.Entry<String,Object> entry:data.entrySet())if(entry.getValue() instanceof List)counts.put(entry.getKey(),((List<?>)entry.getValue()).size());counts.put("MEDIA",files.size());
        return result;
    }
    public static ObjectNode plan(Connection db,Path media) throws Exception {
        requireSchema(db); root(media); ObjectNode report=JSON.createObjectNode();report.put("version",1);
        ArrayNode contexts=report.putArray("contexts");for(Map<String,Object> row:rows(db,"select id from team_profile"))contexts.add(context(db,media,text(row.get("ID"))));
        ObjectNode orphans=report.putObject("quarantinedOrphans");
        orphans.put("rallies",count(db,"select count(*) from rallies where team_profile_id is null or team_profile_id not in (select id from team_profile)"));
        orphans.put("cars",count(db,"select count(*) from team_cars where team_profile_id is null or team_profile_id not in (select id from team_profile)"));
        orphans.put("pecs",count(db,"select count(*) from pecs where rally_id is null or rally_id not in (select id from rallies)"));
        orphans.put("notes",count(db,"select count(*) from notes where pec_id is null or pec_id not in (select id from pecs)"));return report;
    }
    static void schema(Connection db) throws Exception {
        // Expansion is additive/idempotent. No source ownership is changed by this phase.
        String[] sql={
            "alter table auth_users add column if not exists legacy_crew_migrated boolean",
            "alter table team_profile add column if not exists managed_crew boolean",
            "alter table auth_users add constraint if not exists ck_legacy_crew_fence check (legacy_crew_migrated is null or legacy_crew_migrated=false or team_profile_id is null)",
            "create table if not exists crews (id varchar(255) primary key,owner_account_id varchar(255) not null,creation_key varchar(64) not null,name varchar(100) not null,created_at bigint not null,constraint uq_crew_creation unique(owner_account_id,creation_key))",
            "create table if not exists legacy_crew_migrations (team_profile_id varchar(255) primary key,owner_account_id varchar(255) not null unique,manifest_digest varchar(255) not null,source_digest varchar(255) not null,backup_digest varchar(255) not null,approved_by varchar(255) not null,approval_reference varchar(255) not null,converted_at bigint not null)",
            "create table if not exists legacy_crew_migration_lock (id integer primary key)",
            "create table if not exists legacy_auth_contexts (team_profile_id varchar(255) primary key)",
            "insert into legacy_auth_contexts(team_profile_id) select distinct u.team_profile_id from auth_users u where u.team_profile_id is not null and not exists(select 1 from legacy_auth_contexts c where c.team_profile_id=u.team_profile_id) and not exists(select 1 from legacy_crew_migrations m where m.team_profile_id=u.team_profile_id)",
            "alter table auth_users add constraint if not exists fk_legacy_auth_context foreign key(team_profile_id) references legacy_auth_contexts(team_profile_id)"};
        try(Statement statement=db.createStatement()){for(String command:sql)statement.execute(command);}
        if(count(db,"select count(*) from legacy_crew_migration_lock where id=1")==0)update(db,"insert into legacy_crew_migration_lock(id) values (1)");
    }
    static int update(Connection db,String sql,Object... args) throws Exception {try(PreparedStatement statement=db.prepareStatement(sql)){for(int i=0;i<args.length;i++)statement.setObject(i+1,args[i]);return statement.executeUpdate();}}
    static String required(JsonNode node,String field,int max) {
        JsonNode value=node.path(field); if(!value.isTextual()||value.asText().trim().isEmpty()||value.asText().length()>max||value.asText().chars().anyMatch(Character::isISOControl))throw refused("Campo obrigatório de manifesto inválido: "+field);return value.asText();
    }
    static void exact(JsonNode value,String... allowed) {
        if(value==null||!value.isObject())throw refused("Objeto de manifesto inválido.");value.fieldNames().forEachRemaining(k -> {if(!Arrays.asList(allowed).contains(k))throw refused("Campo de manifesto desconhecido.");});
    }
    static CheckedBackup verifyProof(Path backup,Path proofFile,String user,String password) throws Exception {
        CheckedBackup checked=validateBackup(backup);JsonNode saved=checked.metadata,proof=read(proofFile);
        if(proof.path("version").asInt()!=1||!proof.path("verified").asBoolean()||!checked.digest.equals(proof.path("backupDigest").asText())||!saved.path("databaseFingerprint").equals(proof.path("databaseFingerprint")))throw refused("Prova de restauro inválida.");
        Path restored=proofFile.toAbsolutePath().getParent();
        try(Connection db=connect(restored.resolve("restored"),user,password)) {
            if(!saved.path("databaseFingerprint").asText().equals(databaseHash(db))||!saved.path("files").equals(JSON.valueToTree(mediaHashes(restored.resolve("media")))))throw refused("Restauro já não corresponde à prova aprovada.");
            verifyRestoredContexts(db,restored.resolve("media"),saved);
        }
        return checked;
    }
    static void verifyRestoredContexts(Connection db,Path media,JsonNode backup) throws Exception {
        Path original=Paths.get(backup.path("originalMediaRoot").asText()).normalize();
        if(!original.isAbsolute())throw refused("Raiz original de media inválida na prova.");
        ObjectNode actual=JSON.createObjectNode();for(Map<String,Object> row:rows(db,"select id from team_profile")) {
            String id=text(row.get("ID"));actual.put(id,context(db,media,original,id).path("digest").asText());
        }
        if(!actual.equals(backup.path("contextDigests")))throw refused("Inventário restaurado não corresponde ao backup.");
    }
    public static ObjectNode apply(Connection db,Path media,Path manifestFile,String approvedDigest,Path backup,Path proofFile,String user,String password,int maximum) throws Exception {
        requireSchema(db);root(media);
        byte[] approvedBytes=readBytes(manifestFile);
        if(!hash(approvedBytes).equals(approvedDigest))throw refused("Digest de aprovação não corresponde ao manifesto.");
        JsonNode manifest=JSON.readTree(approvedBytes);exact(manifest,"version","approvedBy","approvalReference","entries");
        if(manifest.path("version").asInt()!=1)throw refused("Versão de manifesto não suportada.");required(manifest,"approvedBy",200);required(manifest,"approvalReference",200);
        JsonNode entries=manifest.path("entries");if(!entries.isArray()||entries.size()==0||entries.size()>1000||maximum<1||maximum>1000)throw refused("Lote de manifesto inválido.");
        CheckedBackup checked=verifyProof(backup,proofFile,user,password);String backupDigest=checked.digest;JsonNode backedContexts=checked.metadata.path("contextDigests");
        Set<String> ids=new HashSet<>();
        for(JsonNode entry:entries) {
            exact(entry,"teamProfileId","ownerAccountId","expectedDigest","legacyAccountIds");String id=required(entry,"teamProfileId",255);String owner=required(entry,"ownerAccountId",255);String digest=required(entry,"expectedDigest",64);
            if(!ids.add(id)||!digest.matches("[a-f0-9]{64}")||!entry.path("legacyAccountIds").equals(JSON.valueToTree(Collections.singletonList(owner))))throw refused("Mapeamento de dono/membros inválido ou duplicado.");
            if(!digest.equals(backedContexts.path(id).asText()))throw refused("Backup não cobre o inventário aprovado deste contexto.");
        }
        schema(db); ObjectNode report=JSON.createObjectNode();report.put("version",1);ArrayNode results=report.putArray("contexts");int changed=0;
        for(JsonNode entry:entries) {
            String id=entry.path("teamProfileId").asText(),owner=entry.path("ownerAccountId").asText();
            db.setAutoCommit(false);
            try {
                rows(db,"select id from legacy_crew_migration_lock where id=1 for update");
                List<Map<String,Object>> previous=rows(db,"select * from legacy_crew_migrations where team_profile_id=?",id);
                if(!previous.isEmpty()) {
                    Map<String,Object> receipt=previous.get(0);
                    if(!owner.equals(text(receipt.get("OWNER_ACCOUNT_ID")))||!approvedDigest.equals(text(receipt.get("MANIFEST_DIGEST")))||!backupDigest.equals(text(receipt.get("BACKUP_DIGEST"))))throw refused("Contexto já convertido com outro manifesto/backup; conservar a operação original.");
                    assertReceipt(db,id,owner);db.commit();results.addObject().put("teamProfileId",id).put("status","ALREADY_APPLIED");continue;
                }
                if(changed>=maximum){db.rollback();results.addObject().put("teamProfileId",id).put("status","PENDING");continue;}
                rows(db,"select id from auth_users where id=? for update",owner);
                ObjectNode current=context(db,media,id);
                if(current.path("converted").asBoolean()||current.path("blockingReasons").size()!=0||!current.path("candidateAccountIds").equals(entry.path("legacyAccountIds"))||!current.path("digest").asText().equals(entry.path("expectedDigest").asText()))throw refused("Inventário, dono ou membros divergentes; contexto não convertido.");
                List<Map<String,Object>> accounts=rows(db,"select * from auth_users where id=? and team_profile_id=?",owner,id);
                if(accounts.size()!=1||count(db,"select count(*) from legacy_crew_migrations where owner_account_id=?",owner)>0)throw refused("Proprietário não elegível para este contexto.");
                Map<String,Object> preserved=new TreeMap<>(accounts.get(0));preserved.remove("TEAM_PROFILE_ID");preserved.remove("LEGACY_CREW_MIGRATED");
                String name=text(rows(db,"select name from team_profile where id=?",id).get(0).get("NAME"));
                if(name==null||name.trim().isEmpty()||name.length()>100)throw refused("Nome legado requer decisão explícita antes da conversão.");
                update(db,"insert into crews(id,owner_account_id,creation_key,name,created_at) values (?,?,?,?,?)",id,owner,"migration-"+hash(id.getBytes(java.nio.charset.StandardCharsets.UTF_8)).substring(0,32),name,System.currentTimeMillis());
                update(db,"update team_profile set managed_crew=true where id=?",id);
                if(update(db,"update auth_users set team_profile_id=null,legacy_crew_migrated=true where id=? and team_profile_id=?",owner,id)!=1)throw refused("Vínculo legado mudou durante cutover.");
                update(db,"delete from legacy_auth_contexts where team_profile_id=?",id);
                update(db,"insert into legacy_crew_migrations(team_profile_id,owner_account_id,manifest_digest,source_digest,backup_digest,approved_by,approval_reference,converted_at) values (?,?,?,?,?,?,?,?)",id,owner,approvedDigest,entry.path("expectedDigest").asText(),backupDigest,manifest.path("approvedBy").asText(),manifest.path("approvalReference").asText(),System.currentTimeMillis());
                Map<String,Object> after=new TreeMap<>(rows(db,"select * from auth_users where id=?",owner).get(0));after.remove("TEAM_PROFILE_ID");after.remove("LEGACY_CREW_MIGRATED");
                if(!preserved.equals(after)||!current.path("projectDigest").equals(context(db,media,id).path("projectDigest")))throw refused("Reconciliação divergiu; transação revertida.");
                assertReceipt(db,id,owner);db.commit();changed++;results.addObject().put("teamProfileId",id).put("status","APPLIED");
            } catch(Exception ex) {db.rollback();throw ex;} finally {db.setAutoCommit(true);}
        }
        report.put("converted",changed);return report;
    }
    static void assertReceipt(Connection db,String id,String owner) throws Exception {
        if(count(db,"select count(*) from auth_users where id=? and legacy_crew_migrated=true and team_profile_id is null",owner)!=1||count(db,"select count(*) from crews where id=? and owner_account_id=?",id,owner)!=1||count(db,"select count(*) from team_profile where id=? and managed_crew=true",id)!=1||count(db,"select count(*) from legacy_auth_contexts where team_profile_id=?",id)!=0)throw refused("Journal de migração requer reconciliação; sem fallback legado.");
    }
    public static void checkRollback(Connection db,Path jar) throws Exception {
        requireSchema(db);
        Set<String> available=tables(db);boolean converted=available.contains("CREWS")&&count(db,"select count(*) from crews")>0;
        converted|=available.contains("LEGACY_CREW_MIGRATIONS")&&count(db,"select count(*) from legacy_crew_migrations")>0;
        if(available.contains("AUTH_USERS")&&columns(db,"AUTH_USERS").contains("LEGACY_CREW_MIGRATED"))converted|=count(db,"select count(*) from auth_users where legacy_crew_migrated=true")>0;
        try(JarFile artifact=new JarFile(jar.toFile())) {
            if(converted&&(artifact.getManifest()==null||!CAPABILITY.equals(artifact.getManifest().getMainAttributes().getValue("Recce-Authorization"))))throw refused("Rollback recusado: artefacto não declara autorização compatível.");
        }
    }
    public static Connection connect(Path database,String user,String password) throws Exception {
        Path base=database.toAbsolutePath().normalize();
        if(base.toString().contains(";")||base.toString().chars().anyMatch(Character::isISOControl)||Files.isSymbolicLink(base)||!Files.isRegularFile(Paths.get(base+".mv.db"),LinkOption.NOFOLLOW_LINKS))throw refused("Indica uma base H2 em ficheiro já existente, sem opções de URL.");
        for(Path p=base.getParent();p!=null;p=p.getParent())if(Files.isSymbolicLink(p))throw refused("Base com symlink recusada.");
        Connection db=DriverManager.getConnection("jdbc:h2:file:"+base+";IFEXISTS=TRUE;DB_CLOSE_ON_EXIT=FALSE",user,password);requireH2(db);return db;
    }
    public static void main(String[] args) {
        try {
            if(args.length<1)throw refused("Operações: plan, backup, restore-check, apply, check-rollback.");
            String operation=args[0];Map<String,String> options=new HashMap<>();
            for(int i=1;i<args.length;i+=2){if(i+1>=args.length||!args[i].startsWith("--")||options.put(args[i].substring(2),args[i+1])!=null)throw refused("Argumentos de operação inválidos.");}
            String allowed=operation.equals("plan")||operation.equals("backup")?"database,media,out":operation.equals("restore-check")?"backup,out":operation.equals("apply")?"database,media,manifest,approved-sha256,backup,restore-proof,batch-size,out":operation.equals("check-rollback")?"database,jar":"";
            for(String key:options.keySet())if(!Arrays.asList(allowed.split(",")).contains(key))throw refused("Opção desconhecida para a operação; nenhuma opção será ignorada.");
            String user=System.getenv().getOrDefault("RECCE_MIGRATION_DB_USER","sa"),password=System.getenv().getOrDefault("RECCE_MIGRATION_DB_PASSWORD","");
            ObjectNode result;
            if(operation.equals("restore-check")) result=MigrationSnapshot.restoreCheck(path(options,"backup"),path(options,"out"),user,password);
            else try(Connection db=connect(path(options,"database"),user,password)) {
                if(operation.equals("plan")){result=plan(db,path(options,"media"));writeNew(path(options,"out"),result);}
                else if(operation.equals("backup"))result=MigrationSnapshot.backup(db,path(options,"media"),path(options,"out"));
                else if(operation.equals("apply")) {
                    Path output=path(options,"out");if(Files.exists(output))throw refused("Relatório de operação já existe; escolher destino novo.");
                    int batch;try{batch=Integer.parseInt(options.getOrDefault("batch-size","1"));}catch(NumberFormatException ex){throw refused("Tamanho de lote inválido.");}
                    result=apply(db,path(options,"media"),path(options,"manifest"),option(options,"approved-sha256"),path(options,"backup"),path(options,"restore-proof"),user,password,batch);
                    writeNew(output,result);
                }
                else if(operation.equals("check-rollback")){checkRollback(db,path(options,"jar"));result=JSON.createObjectNode().put("compatible",true);}
                else throw refused("Operação desconhecida.");
            }
            // Never print source rows, credentials, SQL backup contents or approval documents.
            int pending=0;for(JsonNode entry:result.path("contexts"))if(entry.path("status").asText().equals("PENDING"))pending++;
            System.out.println(JSON.writeValueAsString(JSON.createObjectNode().put("operation",operation).put("status","OK").put("converted",result.path("converted").asInt(0)).put("pending",pending)));
        } catch(Exception ex) {System.err.println(ex instanceof IllegalArgumentException?ex.getMessage():"Operação interrompida/recusada. Consultar o journal: podem existir contextos já confirmados. Não restaurar permissões nem dados antigos.");System.exit(1);}
    }
    static String option(Map<String,String> options,String key){String value=options.get(key);if(value==null||value.trim().isEmpty())throw refused("Argumento obrigatório ausente: "+key);return value;}
    static Path path(Map<String,String> options,String key){return Paths.get(option(options,key));}
}
