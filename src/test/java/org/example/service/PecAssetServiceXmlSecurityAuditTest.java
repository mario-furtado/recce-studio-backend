package org.example.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.example.dto.GpsPointDTO;
import org.junit.jupiter.api.Test;
import org.xml.sax.SAXException;

import java.io.ByteArrayInputStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.net.InetSocketAddress;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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

            InvocationTargetException rejected = assertThrows(InvocationTargetException.class, () -> parseGpx.invoke(
                    service,
                    new ByteArrayInputStream(gpx.getBytes(StandardCharsets.UTF_8))));
            assertTrue(rejected.getCause() instanceof SAXException);
        } finally {
            Files.deleteIfExists(externalFile);
        }
    }

    @Test
    void auditSec003DoesNotFetchExternalDtdsEntitiesXIncludeOrSchemas() throws Exception {
        AtomicInteger requests = new AtomicInteger();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/external", exchange -> {
            requests.incrementAndGet();
            byte[] body = "<trkpt lat=\"1\" lon=\"2\"/>".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            try (java.io.OutputStream output = exchange.getResponseBody()) {
                output.write(body);
            }
        });
        server.start();
        try {
            String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/external";
            String[] forbidden = {
                    "<!DOCTYPE gpx SYSTEM '" + url + "'><gpx/>",
                    "<!DOCTYPE gpx [<!ENTITY % remote SYSTEM '" + url + "'>%remote;]><gpx/>",
                    "<!DOCTYPE gpx [<!ENTITY remote SYSTEM '" + url + "'>]><gpx>&remote;</gpx>",
                    "<!DOCTYPE gpx [<!ENTITY a 'abc'><!ENTITY b '&a;&a;'>]><gpx>&b;</gpx>"
            };
            for (String xml : forbidden) {
                assertRejected(xml.getBytes(StandardCharsets.UTF_8));
                assertEquals(0, requests.get(), "XML rejection must happen before any external fetch");
            }
            List<?> ignoredInclude = parse(("<gpx xmlns:xi='http://www.w3.org/2001/XInclude'>"
                    + "<xi:include href='" + url + "'/></gpx>").getBytes(StandardCharsets.UTF_8));
            assertTrue(ignoredInclude.isEmpty());
            parse(("<gpx xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' "
                    + "xsi:noNamespaceSchemaLocation='" + url + "'/>").getBytes(StandardCharsets.UTF_8));
            assertEquals(0, requests.get());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void auditSec003PreservesValidGpxCoordinatesAndOrder() throws Exception {
        List<?> points = parse(("<?xml version='1.0'?><gpx xmlns='http://www.topografix.com/GPX/1/1'>"
                + "<trk><trkseg><trkpt lat='38.72' lon='-9.14'><time>2026-10-23T10:00:00Z</time></trkpt>"
                + "<trkpt lat='39.1' lon='-8.2'><time>2026-10-23T10:00:01Z</time></trkpt>"
                + "</trkseg></trk></gpx>").getBytes(StandardCharsets.UTF_8));
        assertEquals(2, points.size());
        GpsPointDTO first = (GpsPointDTO) points.get(0);
        GpsPointDTO second = (GpsPointDTO) points.get(1);
        assertEquals(38.72, first.getLat());
        assertEquals(-9.14, first.getLng());
        assertEquals(0.0, first.getTimestamp());
        assertEquals(39.1, second.getLat());
        assertEquals(-8.2, second.getLng());
        assertEquals(1.0, second.getTimestamp());
    }

    @Test
    void auditSec003EnforcesExplicitDepthLimit() throws Exception {
        StringBuilder xml = new StringBuilder("<gpx>");
        for (int i = 0; i < 63; i++) xml.append("<x>");
        for (int i = 0; i < 63; i++) xml.append("</x>");
        xml.append("</gpx>");
        assertTrue(parse(xml.toString().getBytes(StandardCharsets.UTF_8)).isEmpty());
        assertRejected(xml.toString().replace("<gpx>", "<gpx><x>")
                .replace("</gpx>", "</x></gpx>").getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void auditSec003EnforcesExplicitByteLimit() throws Exception {
        byte[] atLimit = new byte[10 * 1024 * 1024];
        Arrays.fill(atLimit, (byte) ' ');
        byte[] prefix = "<gpx><!--".getBytes(StandardCharsets.UTF_8);
        byte[] suffix = "--></gpx>".getBytes(StandardCharsets.UTF_8);
        System.arraycopy(prefix, 0, atLimit, 0, prefix.length);
        System.arraycopy(suffix, 0, atLimit, atLimit.length - suffix.length, suffix.length);
        assertTrue(parse(atLimit).isEmpty());
        byte[] overLimit = Arrays.copyOf(atLimit, atLimit.length + 1);
        overLimit[overLimit.length - 1] = (byte) ' ';
        assertRejected(overLimit);
    }

    private void assertRejected(byte[] xml) {
        InvocationTargetException rejected = assertThrows(InvocationTargetException.class, () -> parse(xml));
        assertTrue(rejected.getCause() instanceof SAXException);
    }

    private List<?> parse(byte[] xml) throws Exception {
        PecAssetService service = new PecAssetService(null, null, new ObjectMapper(), null, null);
        Method parser = PecAssetService.class.getDeclaredMethod("parseGpx", java.io.InputStream.class);
        parser.setAccessible(true);
        return (List<?>) parser.invoke(service, new ByteArrayInputStream(xml));
    }
}
