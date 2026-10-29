import { notesOnMap, positionAt, trackSegments, validCoordinate } from './gps-timeline';

describe('FEAT-003 GPS timeline', () => {
  const track = [{ lat: 38, lng: -9, timestamp: 0 }, { lat: 38.001, lng: -9.001, timestamp: 10 }];
  it('interpolates by real elapsed time, including backward seek, without extrapolation', () => {
    const segments = trackSegments(track);
    expect(positionAt(segments, 5)?.lat).toBeCloseTo(38.0005, 6);
    expect(positionAt(segments, 2)?.lng).toBeCloseTo(-9.0002, 6);
    expect(positionAt(segments, -1)).toBeNull();
    expect(positionAt(segments, 11)).toBeNull();
  });
  it('does not connect or interpolate across outages, GPX segments, invalid samples or reversed times', () => {
    for (const broken of [
      [track[0], { ...track[1], timestamp: 30 }],
      [{ ...track[0], segment: 0 }, { ...track[1], segment: 1 }],
      [track[0], { lat: NaN, lng: 0, timestamp: 1 }, track[1]],
      [{ ...track[0], timestamp: 10 }, { ...track[1], timestamp: 0 }],
    ]) {
      const segments = trackSegments(broken);
      expect(segments.length).toBe(2);
      expect(positionAt(segments, 5)).toBeNull();
    }
  });
  it('shows untimed geometry without inventing synchronized positions', () => {
    const segments = trackSegments(track.map(p => ({ ...p, timestamp: null })));
    expect(segments[0].length).toBe(2);
    expect(positionAt(segments, 1)).toBeNull();
    expect(validCoordinate(null, 0)).toBeFalse();
    expect(validCoordinate(91, 0)).toBeFalse();
  });
  it('preserves stationary real coordinates and current note text; omits notes without a location', () => {
    const notes = notesOnMap([
      { id: '1', originalTimestamp: 0, text: 'D6 > E3', latitude: 38, longitude: -9 },
      { id: '2', originalTimestamp: 10, text: 'E3 edited', latitude: 38, longitude: -9 },
      { id: '3', originalTimestamp: null, text: 'No location' },
    ], [], trackSegments(track));
    expect(notes.length).toBe(2);
    expect(notes[0].lat).toBe(notes[1].lat);
    expect(notes[0].lng).toBe(notes[1].lng);
    expect(notes[1].text).toBe('E3 edited');
  });
  it('locates legacy timed notes on the track when recorded coordinates are absent', () => {
    expect(notesOnMap([{ id: '1', originalTimestamp: 5, text: 'D6' }], [], trackSegments(track))[0].lat).toBeCloseTo(38.0005, 6);
  });
});
