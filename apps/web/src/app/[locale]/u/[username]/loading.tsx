import { Bone, CardListBone, CoverBone, PageSkeleton } from "@/components/ui/Skeleton";

export default function ProfileLoading() {
  return (
    <PageSkeleton className="space-y-16">
      <div className="flex items-center gap-5">
        <Bone round className="size-20 shrink-0" />
        <div className="flex-1 space-y-3">
          <Bone className="h-8 w-56 max-w-full" />
          <Bone className="h-3 w-40" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <CoverBone key={i} />
        ))}
      </div>
      <div className="space-y-6">
        <Bone className="h-9 w-full max-w-lg" />
        <CardListBone count={4} />
      </div>
    </PageSkeleton>
  );
}
