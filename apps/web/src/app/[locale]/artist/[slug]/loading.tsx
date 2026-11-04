import { Bone, PageSkeleton, SectionBone, TileGridBone } from "@/components/ui/Skeleton";

export default function ArtistLoading() {
  return (
    <PageSkeleton className="space-y-14">
      <div className="space-y-4">
        <Bone className="h-3 w-40" />
        <Bone className="h-14 w-2/3 max-w-lg" />
      </div>
      <SectionBone>
        <TileGridBone count={12} />
      </SectionBone>
    </PageSkeleton>
  );
}
