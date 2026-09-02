import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
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
          border: "12px solid #111111",
          borderRadius: "32px",
          color: "#111111",
          fontSize: "108px",
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
