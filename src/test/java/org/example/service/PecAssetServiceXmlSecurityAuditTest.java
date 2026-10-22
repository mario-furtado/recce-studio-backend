package org.example.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertThrows;

class PecAssetServiceXmlSecurityAuditTest {

    @Test
    void auditSec003RejectsGpxDocumentsWithExternalEntities() throws Exception {
        Path externalFile = Files.createTempFile("recce-xxe-audit-", ".txt");
        try {
            Files.write(externalFile, "audit-only-secret".getBytes(StandardCharsets.UTF_8));
            String gpx = "<?xml version=\"1.0\"?>"
                    + "<!DOCTYPE gpx [<!ENTITY xxe SYSTEM \"" + externalFile.toUri() + "\">]>"
                    + "<gpx><metadata><name>&xxe;</name></metadata></gpx>";
            PecAssetService service = new PecAssetService(null, null, new ObjectMapper(), null, null);
            Method parseGpx = PecAssetService.class.getDeclaredMethod("parseGpx", java.io.InputStream.class);
            parseGpx.setAccessible(true);

            assertThrows(InvocationTargetException.class, () -> parseGpx.invoke(
                    service,
                    new ByteArrayInputStream(gpx.getBytes(StandardCharsets.UTF_8))));
        } finally {
            Files.deleteIfExists(externalFile);
        }
    }
}
