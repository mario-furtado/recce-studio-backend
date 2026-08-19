package org.example.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Service
public class FileStorageService {
    private static final Logger log = LoggerFactory.getLogger(FileStorageService.class);

    private final String storageType;
    private final Path uploadRoot;
    private final String bucketName;
    private final S3Client s3Client;

    public FileStorageService(
            @Value("${recce.upload-dir:uploads}") String uploadDir,
            @Value("${recce.storage.type:local}") String storageType,
            @Value("${recce.storage.s3.bucket:}") String bucketName,
            @Value("${recce.storage.s3.endpoint:}") String endpoint,
            @Value("${recce.storage.s3.region:us-east-1}") String region,
            @Value("${recce.storage.s3.access-key:}") String accessKey,
            @Value("${recce.storage.s3.secret-key:}") String secretKey,
            @Value("${recce.storage.s3.url-style:virtual}") String urlStyle) {
        String requestedStorageType = storageType == null ? "local" : storageType.trim().toLowerCase();
        boolean hasS3Credentials = StringUtils.hasText(bucketName)
                && StringUtils.hasText(endpoint)
                && StringUtils.hasText(accessKey)
                && StringUtils.hasText(secretKey);
        this.storageType = "local".equals(requestedStorageType) && hasS3Credentials
                ? "s3"
                : requestedStorageType;
        this.uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
        this.bucketName = bucketName;
        this.s3Client = isS3()
                ? buildS3Client(endpoint, region, accessKey, secretKey, urlStyle)
                : null;
        log.info("File storage initialized with type {}", this.storageType);
    }

    public String store(MultipartFile file, String folder, String prefix) {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("Ficheiro vazio");
        }

        String original = StringUtils.cleanPath(file.getOriginalFilename() == null ? prefix : file.getOriginalFilename());
        String extension = "";
        int dotIndex = original.lastIndexOf('.');
        if (dotIndex >= 0) {
            extension = original.substring(dotIndex);
        }

        String cleanFolder = normalizeFolder(folder);
        String objectName = prefix + "-" + UUID.randomUUID() + extension;

        if (isS3()) {
            ensureS3Configured();
            String key = cleanFolder.isEmpty() ? objectName : cleanFolder + "/" + objectName;
            try {
                PutObjectRequest request = PutObjectRequest.builder()
                        .bucket(bucketName)
                        .key(key)
                        .contentType(file.getContentType())
                        .contentLength(file.getSize())
                        .build();
                s3Client.putObject(request, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
                log.info("Stored file in S3 bucket {} with key {}", bucketName, key);
                return key;
            } catch (Exception e) {
                log.warn("Failed to store file in S3 bucket {}: {}", bucketName, e.getMessage());
                throw new RuntimeException("Erro ao guardar ficheiro no bucket: " + e.getMessage());
            }
        }

        try {
            Path targetDir = uploadRoot.resolve(cleanFolder).normalize();
            Files.createDirectories(targetDir);
            Path target = targetDir.resolve(objectName).normalize();
            if (!target.startsWith(uploadRoot)) {
                throw new RuntimeException("Caminho de ficheiro invalido");
            }
            file.transferTo(target.toFile());
            log.info("Stored file locally at {}", target);
            return target.toString();
        } catch (Exception e) {
            throw new RuntimeException("Erro ao guardar ficheiro: " + e.getMessage());
        }
    }

    public Resource loadAsResource(String storageKey) {
        if (!StringUtils.hasText(storageKey)) {
            throw new RuntimeException("Ficheiro nao encontrado");
        }

        if (isS3Key(storageKey)) {
            ensureS3Configured();
            InputStream inputStream = open(storageKey);
            return new InputStreamResource(inputStream) {
                @Override
                public String getFilename() {
                    return fileName(storageKey);
                }
            };
        }

        return new FileSystemResource(storageKey);
    }

    public InputStream open(String storageKey) {
        if (!StringUtils.hasText(storageKey)) {
            throw new RuntimeException("Ficheiro nao encontrado");
        }

        if (isS3Key(storageKey)) {
            ensureS3Configured();
            return s3Client.getObject(GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(storageKey)
                    .build());
        }

        try {
            return Files.newInputStream(Paths.get(storageKey));
        } catch (Exception e) {
            throw new RuntimeException("Erro ao abrir ficheiro: " + e.getMessage());
        }
    }

    public byte[] loadBytes(String storageKey) {
        if (!StringUtils.hasText(storageKey)) {
            throw new RuntimeException("Ficheiro nao encontrado");
        }

        if (!isS3Key(storageKey)) {
            try {
                return Files.readAllBytes(Paths.get(storageKey));
            } catch (Exception e) {
                throw new RuntimeException("Erro ao ler ficheiro: " + e.getMessage());
            }
        }

        try (InputStream inputStream = open(storageKey);
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = inputStream.read(buffer)) != -1) {
                outputStream.write(buffer, 0, read);
            }
            return outputStream.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Erro ao ler ficheiro do bucket: " + e.getMessage());
        }
    }

    public void delete(String storageKey) {
        if (!StringUtils.hasText(storageKey)) {
            return;
        }

        try {
            if (isS3Key(storageKey)) {
                ensureS3Configured();
                s3Client.deleteObject(DeleteObjectRequest.builder()
                        .bucket(bucketName)
                        .key(storageKey)
                        .build());
                return;
            }
            Files.deleteIfExists(Paths.get(storageKey));
        } catch (Exception ignored) {
        }
    }

    public String fileName(String storageKey) {
        if (!StringUtils.hasText(storageKey)) {
            return "";
        }
        String normalized = storageKey.replace('\\', '/');
        int slash = normalized.lastIndexOf('/');
        return slash >= 0 ? normalized.substring(slash + 1) : normalized;
    }

    private boolean isS3Key(String storageKey) {
        return isS3() && !storageKey.matches("^[A-Za-z]:\\\\.*") && !storageKey.startsWith("/");
    }

    private boolean isS3() {
        return "s3".equals(storageType) || "bucket".equals(storageType);
    }

    private void ensureS3Configured() {
        if (!StringUtils.hasText(bucketName) || s3Client == null) {
            throw new RuntimeException("Storage S3 nao configurado. Defina as variaveis RECCE_STORAGE_*.");
        }
    }

    private S3Client buildS3Client(String endpoint, String region, String accessKey, String secretKey, String urlStyle) {
        if (!StringUtils.hasText(endpoint)
                || !StringUtils.hasText(accessKey)
                || !StringUtils.hasText(secretKey)) {
            return null;
        }

        boolean usePathStyle = "path".equalsIgnoreCase(urlStyle) || "path-style".equalsIgnoreCase(urlStyle);

        return S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                .region(Region.of(StringUtils.hasText(region) ? region : "us-east-1"))
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(usePathStyle).build())
                .build();
    }

    private String normalizeFolder(String folder) {
        if (!StringUtils.hasText(folder)) {
            return "";
        }
        return folder
                .replace('\\', '/')
                .replaceAll("^/+", "")
                .replaceAll("/+$", "");
    }
}
