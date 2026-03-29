import { memo } from 'react';

const SkeletonBase = ({ className }) => (
  <div className={`animate-pulse bg-bg-hover rounded ${className}`} />
);

export const UserListItemSkeleton = memo(() => (
  <div className="flex items-center gap-3 px-3 py-2.5">
    <SkeletonBase className="w-11 h-11 rounded-full shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <div className="flex justify-between items-center gap-2">
        <SkeletonBase className="h-3.5 w-28 rounded-md" />
        <SkeletonBase className="h-2.5 w-10 rounded-md" />
      </div>
      <SkeletonBase className="h-2.5 w-40 rounded-md" />
    </div>
  </div>
));

export const MessageSkeleton = memo(({ align = 'left' }) => {
  const isRight = align === 'right';
  return (
    <div className={`flex items-end gap-2 px-4 py-1 ${isRight ? 'flex-row-reverse' : ''}`}>
      {!isRight && <SkeletonBase className="w-8 h-8 rounded-full shrink-0" />}
      <div className={`space-y-1.5 max-w-[60%] ${isRight ? 'items-end' : 'items-start'} flex flex-col`}>
        <SkeletonBase className={`h-10 rounded-2xl ${isRight ? 'w-48' : 'w-56'}`} />
        <SkeletonBase className="h-2 w-12 rounded-md" />
      </div>
    </div>
  );
});

export const ChatSkeletons = memo(() => (
  <div className="flex flex-col gap-1 py-2">
    <MessageSkeleton align="left" />
    <MessageSkeleton align="right" />
    <MessageSkeleton align="left" />
    <MessageSkeleton align="right" />
    <MessageSkeleton align="left" />
    <MessageSkeleton align="right" />
  </div>
));

UserListItemSkeleton.displayName = 'UserListItemSkeleton';
MessageSkeleton.displayName = 'MessageSkeleton';
ChatSkeletons.displayName = 'ChatSkeletons';
