import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const MapView = forwardRef(({ users, userLocation, theme, isFollowing }, ref) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({});
  const userMarker = useRef(null);
  const initialCenterSet = useRef(false);

  const styles = {
    dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  };

  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: styles[theme] || styles.dark,
      center: [77.5946, 12.9716],
      zoom: 15,
      pitch: 60,
      bearing: -20,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "bottom-right");

    // 🏗️ RELIABLE LAYER RESTORATION
    // 'styledata' fires when style changes, ensuring 3D layers are always re-added
    map.current.on("styledata", () => {
      add3D();
    });

    map.current.on("error", (e) => console.error("MapLibre Error:", e));
  }, []);

  // 🌓 Handle Theme Change
  useEffect(() => {
    if (!map.current) return;
    map.current.setStyle(styles[theme]);
  }, [theme]);

  useImperativeHandle(ref, () => ({
    handleRecenter: () => {
      if (map.current && userLocation) {
        map.current.easeTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: 17,
          duration: 1000,
          essential: true,
        });
      }
    },
  }));

  // 🎯 Update Blue Dot Marker
  useEffect(() => {
    if (!map.current || !userLocation) return;

    const { lng, lat, heading } = userLocation;

    if (!userMarker.current) {
      const el = document.createElement("div");
      el.className = "user-location-marker";
      el.innerHTML = `
        <div class="pulse-ring"></div>
        <div class="glow-ring"></div>
        <div class="direction-cone"></div>
        <div class="center-dot"></div>
      `;

      userMarker.current = new maplibregl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat([lng, lat])
        .addTo(map.current);
    } else {
      userMarker.current.setLngLat([lng, lat]);
    }

    const el = userMarker.current.getElement();
    const cone = el.querySelector(".direction-cone");
    
    if (heading !== null && heading !== undefined) {
      cone.style.transform = `rotate(${heading}deg)`;
      cone.style.display = "block";
    } else {
      cone.style.display = "none";
    }

    if (!initialCenterSet.current) {
      map.current.jumpTo({ center: [lng, lat] });
      initialCenterSet.current = true;
    } else if (isFollowing) {
      map.current.easeTo({
        center: [lng, lat],
        duration: 800,
        essential: true,
      });
    }
  }, [userLocation, theme, isFollowing]);

  const add3D = () => {
    if (!map.current || map.current.getLayer("3d-buildings")) return;

    map.current.addLayer({
      id: "3d-buildings",
      source: "openmaptiles",
      "source-layer": "building",
      type: "fill-extrusion",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": "#888",
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14, 0,
          18, 120
        ],
        "fill-extrusion-opacity": 0.85,
      },
    });
  };

  useEffect(() => {
    if (!map.current) return;

    users.forEach((user) => {
      if (user.id === "user1") return;

      if (!markers.current[user.id]) {
        const el = document.createElement("div");
        el.className = "marker";
        el.style.width = "10px";
        el.style.height = "10px";
        el.style.backgroundColor = "red";
        el.style.borderRadius = "50%";

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([user.lng, user.lat])
          .addTo(map.current);

        markers.current[user.id] = marker;
      } else {
        markers.current[user.id].setLngLat([user.lng, user.lat]);
      }
    });

    Object.keys(markers.current).forEach((id) => {
      if (!users.find((u) => u.id === id) && id !== "user1") {
        markers.current[id].remove();
        delete markers.current[id];
      }
    });
  }, [users, theme]);

  return (
    <div 
      ref={mapContainer} 
      className="map-viewport" 
      style={{ width: "100%", height: "100vh", position: "relative" }} 
    />
  );
});

export default MapView;