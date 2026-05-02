import React from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";

// Map data source
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const MapChart = ({ attackIps = [] }) => {
  return (
    <div
      style={{
        background: "#0c1017",
        borderRadius: "12px",
        minHeight: "300px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* INNER PADDING WRAPPER (fixes overflow issue) */}
      <div style={{ padding: "12px", flex: 1 }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "10px",
            overflow: "hidden",
          }}
        >
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{
              scale: 100, // reduced to fit perfectly
              center: [0, 20],
            }}
            style={{
              width: "100%",
              height: "auto",
              maxHeight: "280px",
            }}
          >
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
                      hover: { fill: "#262f3e", outline: "none" },
                      pressed: { outline: "none" },
                    }}
                  />
                ))
              }
            </Geographies>

            {/* ATTACK MARKERS */}
            {attackIps
              .filter((point) => point.lng && point.lat)
              .map((point, index) => (
                <Marker key={index} coordinates={[point.lng, point.lat]}>
                  <circle
                    r={4}
                    fill="#ff4d4d"
                    stroke="#ffffff"
                    strokeWidth={1}
                  />
                  <text
                    textAnchor="middle"
                    y={-10}
                    style={{
                      fill: "#94a3b8",
                      fontSize: "10px",
                      fontWeight: "bold",
                    }}
                  >
                    {point.country}
                  </text>
                </Marker>
              ))}
          </ComposableMap>
        </div>
      </div>
    </div>
  );
};

export default MapChart;
