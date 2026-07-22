import manifest from "@/data/generated/asset-manifest.json";

export interface ManualAsset {
  id: string;
  source: string;
  page: number;
  path: string;
  caption?: string;
}

export function getAssetById(id: string): ManualAsset | undefined {
  return (manifest.assets as ManualAsset[]).find((a) => a.id === id);
}

export function getAssetsForPage(source: string, page: number): ManualAsset[] {
  return (manifest.assets as ManualAsset[]).filter(
    (a) => a.source === source && a.page === page,
  );
}
