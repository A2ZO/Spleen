import { Bone, CoverBone, LinesBone, PageSkeleton } from "@/components/ui/Skeleton";

export default function AlbumLoading() {
  return (
    <PageSkeleton className="space-y-16">
      <div className="grid gap-8 md:grid-cols-[minmax(0,320px)_1fr_minmax(0,300px)] md:gap-10">
        <CoverBone className="mx-auto w-full max-w-xs md:max-w-none" />
        <div className="space-y-4">
          <div className="flex gap-2">
            <Bone round className="h-6 w-16" />
            <Bone round className="h-6 w-12" />
          </div>
          <Bone className="h-12 w-4/5" />
          <Bone className="h-5 w-1/2" />
          <Bone className="h-3 w-2/3" />
        </div>
        <div className="space-y-3">
          <Bone className="h-10 w-full" />
          <Bone className="h-10 w-full" />
        </div>
      </div>
      <LinesBone lines={8} className="max-w-2xl" />
    </PageSkeleton>
  );
}
