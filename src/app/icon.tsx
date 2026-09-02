import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#facc00",
          border: "2.5px solid #111111",
          borderRadius: "5px",
          color: "#111111",
          fontSize: "20px",
          fontWeight: 900,
          fontFamily: "sans-serif",
        }}
      >
        楽
      </div>
    ),
    {
      ...size,
    }
  );
}
