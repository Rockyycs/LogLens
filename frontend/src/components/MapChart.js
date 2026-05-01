import React from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";

const geoUrl = "https://raw.githubusercontent.com/lotusms/world-map-data/main/world.json";

const MapChart = ({ attackIps = [] }) => {
  return (
    <div style={{ background: "#0c1017", borderRadius: "12px", height: "100%", minHeight: "300px" }}>
      <ComposableMap projectionConfig={{ scale: 140 }}>
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#1b2331"
                stroke="#05070a"
                style={{
                  default: { outline: "none" },
                  hover: { fill: "#262f3e", outline: "none" }
                }}
              />
            ))
          }
        </Geographies>

        {/* Real Markers from Backend */}
        {attackIps.map((point, index) => (
          <Marker key={index} coordinates={[point.lng, point.lat]}>
            <circle r={4} fill="#ff4d4d" stroke="#fff" strokeWidth={1} />
            <text textAnchor="middle" y={-10} style={{ fill: "#94a3b8", fontSize: "8px" }}>
              {point.country}
            </text>
          </Marker>
        ))}
      </ComposableMap>
    </div>
  );
};

export default MapChart;
