import React, { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import "leaflet-routing-machine";

// Fix default marker icons broken by webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

// Custom colored markers
const makeIcon = (color) =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:16px;height:16px;border-radius:50%;
      background:${color};border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.5);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const greenIcon = makeIcon("#1db954");
const redIcon   = makeIcon("#e53935");
const blueIcon  = makeIcon("#2196f3");

// OSRM Routing layer — draws the best route between two points
const RoutingMachine = ({ pickup, dropoff, onRouteFound }) => {
  const map = useMap();
  const routingRef = useRef(null);

  useEffect(() => {
    if (!pickup || !dropoff) return;
    if (!map) return;

    // Remove old routing control
    if (routingRef.current) {
      map.removeControl(routingRef.current);
      routingRef.current = null;
    }

    routingRef.current = L.Routing.control({
      waypoints: [
        L.latLng(pickup.lat, pickup.lng),
        L.latLng(dropoff.lat, dropoff.lng),
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      show: false,          // hide the turn-by-turn panel
      createMarker: () => null, // we draw our own markers
      lineOptions: {
        styles: [{ color: "#fff", opacity: 0.9, weight: 5 }],
        extendToWaypoints: true,
        missingRouteTolerance: 0,
      },
      router: L.Routing.osrmv1({
        serviceUrl: "https://router.project-osrm.org/route/v1",
      }),
    })
      .on("routesfound", (e) => {
        const route = e.routes[0];
        const distKm = (route.summary.totalDistance / 1000).toFixed(1);
        const durationMin = Math.ceil(route.summary.totalTime / 60);
        if (onRouteFound) onRouteFound({ distKm: parseFloat(distKm), durationMin });
      })
      .addTo(map);

    return () => {
      if (routingRef.current) {
        map.removeControl(routingRef.current);
        routingRef.current = null;
      }
    };
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  return null;
};

// Recenter map when coords change
const Recenter = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom || map.getZoom());
  }, [center, map, zoom]);
  return null;
};

/**
 * MapView props:
 *  pickup   — { lat, lng, address }
 *  dropoff  — { lat, lng, address }
 *  captain  — { lat, lng }         (optional, shows captain marker)
 *  onRouteFound — ({ distKm, durationMin }) callback
 *  height   — css string, default "100%"
 */
const MapView = ({ pickup, dropoff, captain, onRouteFound, height = "100%" }) => {
  const defaultCenter = [20.5937, 78.9629]; // India center
  const mapCenter = pickup
    ? [pickup.lat, pickup.lng]
    : defaultCenter;

  return (
    <MapContainer
      center={mapCenter}
      zoom={13}
      style={{ width: "100%", height }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {pickup && (
        <Marker position={[pickup.lat, pickup.lng]} icon={greenIcon}>
          <Popup>📍 Pickup: {pickup.address || "Pickup"}</Popup>
        </Marker>
      )}

      {dropoff && (
        <Marker position={[dropoff.lat, dropoff.lng]} icon={redIcon}>
          <Popup>🏁 Dropoff: {dropoff.address || "Dropoff"}</Popup>
        </Marker>
      )}

      {captain && (
        <Marker position={[captain.lat, captain.lng]} icon={blueIcon}>
          <Popup>🚗 Your Captain</Popup>
        </Marker>
      )}

      {pickup && dropoff && (
        <RoutingMachine
          pickup={pickup}
          dropoff={dropoff}
          onRouteFound={onRouteFound}
        />
      )}

      {pickup && <Recenter center={[pickup.lat, pickup.lng]} />}
    </MapContainer>
  );
};

export default MapView;
