import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useFormValidation } from '@/hooks/useFormValidation';
import { createNoteSchema, type CreateNoteInput } from '@/utils/validation';

interface NoteFormProps {
  initialValues?: Partial<CreateNoteInput>;
  onSubmit: (data: CreateNoteInput) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private — only you can see this' },
  { value: 'public', label: 'Public — visible to everyone' },
];

export function NoteForm({ initialValues, onSubmit, isLoading, submitLabel = 'Save' }: NoteFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [content, setContent] = useState(initialValues?.content ?? '');
  const [visibility, setVisibility] = useState<'public' | 'private'>(initialValues?.visibility ?? 'private');
  const { errors, validate } = useFormValidation(createNoteSchema);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const data = validate({ title, content, visibility });
    if (!data) return;
    await onSubmit(data);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={errors.title}
        maxLength={200}
        placeholder="Note title..."
        required
      />
      <Textarea
        label="Content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        error={errors.content}
        rows={12}
        maxLength={50000}
        placeholder="Write your note here..."
        className="resize-y min-h-[200px]"
        required
      />
      <Select
        label="Visibility"
        value={visibility}
        onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
        options={VISIBILITY_OPTIONS}
        error={errors.visibility}
      />
      <div className="flex justify-end">
        <Button type="submit" isLoading={isLoading}>{submitLabel}</Button>
      </div>
    </form>
  );
}
