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

// Fix webpack marker icon resolution
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

// ── SVG pin markers ───────────────────────────────────────────
const makePinIcon = (fill, label = "") =>
  L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <svg width="28" height="40" viewBox="0 0 28 40" fill="none"
           xmlns="http://www.w3.org/2000/svg">
        <path d="M14 0C6.268 0 0 6.268 0 14c0 9.656 14 26 14 26S28 23.656 28 14
                 C28 6.268 21.732 0 14 0z" fill="${fill}"/>
        <circle cx="14" cy="14" r="6" fill="white"/>
      </svg>
      ${label ? `<span style="font-size:10px;font-weight:700;color:${fill};margin-top:-2px;text-shadow:0 1px 2px #fff">${label}</span>` : ""}
    </div>`,
    iconSize: [28, 42],
    iconAnchor: [14, 42],
    popupAnchor: [0, -44],
  });

const makePulseIcon = (fill) =>
  L.divIcon({
    className: "",
    html: `<div style="position:relative;width:36px;height:36px">
      <div style="
        position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        width:36px;height:36px;border-radius:50%;background:${fill}33;
        animation:ucab-pulse 1.4s ease-out infinite;
      "></div>
      <div style="
        position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        width:20px;height:20px;border-radius:50%;
        background:${fill};border:3px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,.4);
      "></div>
      <style>@keyframes ucab-pulse{0%{transform:translate(-50%,-50%) scale(1);opacity:.7}100%{transform:translate(-50%,-50%) scale(2.2);opacity:0}}</style>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });

const greenPin  = makePinIcon("#00c853", "A");
const redPin    = makePinIcon("#e53935", "B");
const blueIcon  = makePulseIcon("#2979ff");

// ── OSRM Routing layer — GREEN route line ─────────────────────
const RoutingMachine = ({ pickup, dropoff, onRouteFound }) => {
  const map = useMap();
  const routingRef = useRef(null);

  useEffect(() => {
    if (!pickup || !dropoff || !map) return;

    if (routingRef.current) {
      try { map.removeControl(routingRef.current); } catch (_) {}
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
      show: false,
      createMarker: () => null,
      lineOptions: {
        styles: [
          { color: "#00c853", opacity: 1,   weight: 6 },  // bright green main line
          { color: "#ffffff", opacity: 0.35, weight: 2 },  // white inner highlight
        ],
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
        try { map.removeControl(routingRef.current); } catch (_) {}
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
 *  captain  — { lat, lng }         (optional)
 *  onRouteFound — ({ distKm, durationMin }) callback
 *  height   — css string, default "100%"
 */
const MapView = ({ pickup, dropoff, captain, onRouteFound, height = "100%" }) => {
  const defaultCenter = [20.5937, 78.9629]; // India center
  const mapCenter = pickup ? [pickup.lat, pickup.lng] : defaultCenter;

  return (
    <MapContainer
      center={mapCenter}
      zoom={13}
      style={{ width: "100%", height }}
      zoomControl={true}
    >
      {/* CartoDB Voyager — clean, modern, great for navigation */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={20}
        subdomains="abcd"
      />

      {pickup && (
        <Marker position={[pickup.lat, pickup.lng]} icon={greenPin}>
          <Popup><strong>📍 Pickup</strong><br/>{pickup.address || "Pickup location"}</Popup>
        </Marker>
      )}

      {dropoff && (
        <Marker position={[dropoff.lat, dropoff.lng]} icon={redPin}>
          <Popup><strong>🏁 Dropoff</strong><br/>{dropoff.address || "Dropoff location"}</Popup>
        </Marker>
      )}

      {captain && (
        <Marker position={[captain.lat, captain.lng]} icon={blueIcon}>
          <Popup>🚗 Your Captain is on the way!</Popup>
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
