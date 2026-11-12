import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVerticalIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

export function SortableProjects({
  ids,
  disabled,
  onReorder,
  children,
}: {
  ids: string[];
  disabled: boolean;
  onReorder: (ids: string[]) => void;
  children: React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) {
      return;
    }
    onReorder(arrayMove(ids, from, to));
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <SortableContext
        disabled={disabled}
        items={ids}
        strategy={rectSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
}

// The handle sits left of the settings button; the card itself stays a plain
// link so clicks never turn into drags.
export function SortableProject({
  id,
  disabled,
  handleClassName,
  children,
}: {
  id: string;
  disabled: boolean;
  handleClassName?: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  return (
    <div
      className={cn('group/sortable relative', isDragging && 'z-20 opacity-80')}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {children}
      {!disabled && (
        <button
          aria-label="Drag to reorder"
          className={cn(
            'absolute z-10 flex size-8 cursor-grab items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-accent focus-visible:opacity-100 active:cursor-grabbing group-hover/sortable:opacity-100',
            handleClassName
          )}
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon size={16} />
        </button>
      )}
    </div>
  );
}
