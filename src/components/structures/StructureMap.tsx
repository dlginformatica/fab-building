import { useEffect, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center); }, [center, map]);
  return null;
}

export default function StructureMap({
  lat, lng, onDragEnd,
}: {
  lat: number | null;
  lng: number | null;
  onDragEnd: (lat: number, lng: number) => void;
}) {
  const center: [number, number] = useMemo(
    () => (lat != null && lng != null ? [lat, lng] : [41.9028, 12.4964]),
    [lat, lng],
  );
  return (
    <MapContainer center={center} zoom={lat != null ? 15 : 5} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter center={center} />
      {lat != null && lng != null && (
        <Marker
          position={[lat, lng]}
          draggable
          eventHandlers={{
            dragend: (e: any) => {
              const p = e.target.getLatLng();
              onDragEnd(p.lat, p.lng);
            },
          }}
        />
      )}
    </MapContainer>
  );
}