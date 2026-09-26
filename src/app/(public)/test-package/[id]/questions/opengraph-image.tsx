import { ImageResponse } from "next/og";
import {
  TEST_PACKAGE_OG_ALT,
  TestPackageOgCard,
} from "@/components/seo/og-test-package-card";
import { getTestPackageMetadata } from "@/features/test-package/queries";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/seo";

// Duplikat yang disengaja terhadap `opengraph-image` di segmen induk: gambar OG
// hanya berlaku untuk segmen tempat file-nya berada dan turunannya yang TIDAK
// menulis `openGraph` sendiri. Halaman ini menulisnya, jadi butuh file sendiri.

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = TEST_PACKAGE_OG_ALT;

export default async function TestPackageQuestionsOgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const testPackageId = Number(id);
  const testPackage = Number.isInteger(testPackageId)
    ? await getTestPackageMetadata(testPackageId)
    : null;

  return new ImageResponse(<TestPackageOgCard testPackage={testPackage} />, {
    ...size,
  });
}
