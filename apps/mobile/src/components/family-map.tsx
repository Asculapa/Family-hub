import type { LocationLatest, LocationPoint, Member } from '@family-hub/data';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { useTheme } from '@/hooks/use-theme';

export interface FamilyMapProps {
  members: Member[];
  latest: LocationLatest[];
  trail: LocationPoint[];
  selected: string | null;
  statusOf: (userId: string) => string;
  onSelect: (userId: string) => void;
  height: number;
  /** False for a static preview (no panning, zooming or marker taps). */
  interactive?: boolean;
}

/** Native map: Apple Maps on iOS, Google Maps on Android (spec section 3). */
export function FamilyMap({
  members,
  latest,
  trail,
  selected,
  statusOf,
  onSelect,
  height,
  interactive = true,
}: FamilyMapProps) {
  const theme = useTheme();
  const map = useRef<MapView>(null);
  const byId = new Map(members.map((m) => [m.userId, m]));

  // Fit everyone, or the selected member's trail.
  const focus = selected && trail.length ? trail : latest.filter((l) => !selected || l.user_id === selected);
  const key = focus.map((p) => `${p.lat},${p.lng}`).join('|');
  useEffect(() => {
    if (!focus.length) return;
    map.current?.fitToCoordinates(
      focus.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true },
    );
    // Re-fit only when the positions change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <MapView
      ref={map}
      style={[styles.map, { height }]}
      showsUserLocation={interactive}
      showsMyLocationButton={false}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={interactive}
      pitchEnabled={interactive}
      pointerEvents={interactive ? 'auto' : 'none'}>
      {latest.map((l) => {
        const m = byId.get(l.user_id);
        return (
          <Marker
            key={l.user_id}
            coordinate={{ latitude: l.lat, longitude: l.lng }}
            title={m?.displayName}
            description={statusOf(l.user_id)}
            pinColor={m?.color ?? theme.primary}
            onPress={() => onSelect(l.user_id)}
          />
        );
      })}
      {selected && trail.length > 1 ? (
        <Polyline
          coordinates={trail.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
          strokeColor={byId.get(selected)?.color ?? theme.primary}
          strokeWidth={4}
        />
      ) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', borderRadius: 16 },
});
