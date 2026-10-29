package org.example.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.dto.GpsPointDTO;
import org.junit.jupiter.api.Test;
import java.io.ByteArrayInputStream;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class GpsTimelineTest {
    @SuppressWarnings("unchecked")
    private List<GpsPointDTO> parse(String xml) throws Exception {
        Method method = PecAssetService.class.getDeclaredMethod("parseGpx", java.io.InputStream.class);
        method.setAccessible(true);
        return (List<GpsPointDTO>) method.invoke(new PecAssetService(null, null, new ObjectMapper(), null, null),
                new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
    }

    @Test void preservesRealElapsedTimeRatherThanPointIndex() throws Exception {
        List<GpsPointDTO> points = parse("<gpx><trk><trkseg>"
                + "<trkpt lat='38' lon='-9'><time>2026-10-23T10:00:00Z</time></trkpt>"
                + "<trkpt lat='38.1' lon='-9.1'><time>2026-10-23T10:00:07.500Z</time></trkpt>"
                + "</trkseg></trk></gpx>");
        assertEquals(0.0, points.get(0).getTimestamp());
        assertEquals(7.5, points.get(1).getTimestamp());
    }

    @Test void doesNotInventTimeForUntimedPoints() throws Exception {
        List<GpsPointDTO> points = parse("<gpx><trk><trkseg><trkpt lat='38' lon='-9'/></trkseg></trk></gpx>");
        assertNull(points.get(0).getTimestamp());
    }

    @Test void preservesSegmentsAndRejectsInvalidCoordinatesOrTime() throws Exception {
        List<GpsPointDTO> points = parse("<gpx><trk><trkseg><trkpt lat='38' lon='-9'/></trkseg>"
                + "<trkseg><trkpt lat='39' lon='-8'/></trkseg></trk></gpx>");
        assertEquals(0, points.get(0).getSegment());
        assertEquals(1, points.get(1).getSegment());
        assertThrows(java.lang.reflect.InvocationTargetException.class, () -> parse("<gpx><trkpt lat='91' lon='0'/></gpx>"));
        assertThrows(java.lang.reflect.InvocationTargetException.class, () -> parse("<gpx><trkpt lat='1' lon='0'><time>broken</time></trkpt></gpx>"));
    }
}
