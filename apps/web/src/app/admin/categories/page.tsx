'use client';

import { collection, orderBy, query } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { categoryInputSchema, type Category } from '@dolgers/shared';
import { useAction, useLiveQuery } from '@/components/dashboard/hooks';
import { EmptyState, ErrorText, Field, Loading, PageHeader, Panel, SuccessText } from '@/components/dashboard/ui';
import { adminApi } from '@/lib/firebase/api';

type Mode = { kind: 'new'; parentId: string | null } | { kind: 'edit'; category: Category };

interface Node {
  category: Category;
  children: Node[];
}

function buildTree(categories: Category[]): Node[] {
  const nodes = new Map(categories.map((c) => [c.id, { category: c, children: [] as Node[] }]));
  const roots: Node[] = [];
  for (const node of nodes.values()) {
    const parent = node.category.parentId ? nodes.get(node.category.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list: Node[]) => {
    list.sort((a, b) => a.category.order - b.category.order || a.category.name.localeCompare(b.category.name));
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

function Tree({ nodes, depth, onEdit, onAdd, selected }: { nodes: Node[]; depth: number; onEdit: (c: Category) => void; onAdd: (c: Category) => void; selected: string | null }) {
  return (
    <ul className={depth ? 'border-l border-line' : ''}>
      {nodes.map((n) => (
        <li key={n.category.id}>
          <div className={`group flex flex-wrap items-center gap-x-4 gap-y-1 py-2 pr-2 ${selected === n.category.id ? 'bg-cream' : ''}`} style={{ paddingLeft: depth ? 16 : 0 }}>
            <span className={depth === 0 ? 'display text-[20px]' : 'text-sm font-medium'}>{n.category.name}</span>
            <code className="text-xs text-faint">/{n.category.path.join('/')}</code>
            <span className="text-xs text-muted">order {n.category.order}</span>
            <span className="ml-auto flex gap-3">
              <button type="button" className="label text-muted hover:text-ink" onClick={() => onEdit(n.category)} aria-label={`Edit ${n.category.name}`}>Edit</button>
              <button type="button" className="label text-muted hover:text-ink" onClick={() => onAdd(n.category)} aria-label={`Add a subcategory under ${n.category.name}`}>Add sub</button>
            </span>
          </div>
          {n.children.length ? (
            <div style={{ marginLeft: depth ? 16 : 8 }}>
              <Tree nodes={n.children} depth={depth + 1} onEdit={onEdit} onAdd={onAdd} selected={selected} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function CategoryForm({ mode, categories, onDone }: { mode: Mode; categories: Category[]; onDone: () => void }) {
  const editing = mode.kind === 'edit' ? mode.category : null;
  const [name, setName] = useState(editing?.name ?? '');
  const [parentId, setParentId] = useState<string>(editing ? editing.parentId ?? '' : mode.kind === 'new' ? mode.parentId ?? '' : '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [order, setOrder] = useState(String(editing?.order ?? 0));
  const action = useAction();
  const options = [...categories].sort((a, b) => a.path.join('/').localeCompare(b.path.join('/')));

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = categoryInputSchema.safeParse({
          ...(editing ? { id: editing.id } : {}),
          name,
          parentId: parentId || null,
          description,
          order: Number.parseInt(order, 10) || 0,
        });
        if (!parsed.success) return action.setError(parsed.error.issues[0].path[0] === 'name' ? 'Give the category a name.' : parsed.error.issues[0].message);
        void action.run(async () => {
          await adminApi({ action: 'upsertCategory', data: parsed.data });
          if (!editing) { setName(''); setDescription(''); }
        }, editing ? 'Category saved.' : `${parsed.data.name} added.`);
      }}
    >
      <Field id="cat-name" label="Name"><input id="cat-name" className="field" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field id="cat-parent" label="Parent" hint={editing ? 'Categories cannot be moved once created, and the web address stays the same if you rename one.' : 'Leave empty for a top-level department.'}>
        <select id="cat-parent" className="field" value={parentId} disabled={!!editing} onChange={(e) => setParentId(e.target.value)}>
          <option value="">None (top level)</option>
          {options.map((c) => <option key={c.id} value={c.id}>{c.path.join(' / ')}</option>)}
        </select>
      </Field>
      <Field id="cat-description" label="Description" hint="Shown at the top of the category page.">
        <textarea id="cat-description" className="field min-h-[88px]" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field id="cat-order" label="Sort order" hint="Lower numbers come first.">
        <input id="cat-order" type="number" min={0} max={1000} className="field w-28" value={order} onChange={(e) => setOrder(e.target.value)} />
      </Field>
      <ErrorText>{action.error}</ErrorText>
      <SuccessText>{action.success}</SuccessText>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary flex-1" disabled={action.pending}>{action.pending ? 'Saving…' : editing ? 'Save category' : 'Add category'}</button>
        {editing ? <button type="button" className="btn btn-secondary" onClick={onDone}>Cancel</button> : null}
      </div>
    </form>
  );
}

export default function AdminCategoriesPage() {
  const categories = useLiveQuery<Category>('categories', (db) => query(collection(db, 'categories'), orderBy('order')));
  const tree = useMemo(() => buildTree(categories.data), [categories.data]);
  const [mode, setMode] = useState<Mode>({ kind: 'new', parentId: null });
  const formKey = mode.kind === 'edit' ? `edit-${mode.category.id}` : `new-${mode.parentId ?? 'root'}`;
  const parentName = mode.kind === 'new' && mode.parentId ? categories.data.find((c) => c.id === mode.parentId)?.name : null;

  return (
    <>
      <PageHeader eyebrow="Catalog" title="Categories" description="The menu shoppers browse by. Vendors file each product under one of these." />
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          {categories.error ? <ErrorText>{categories.error}</ErrorText> : categories.loading ? <Loading /> : tree.length === 0 ? (
            <EmptyState title="No categories yet" body="Start with the two departments, Men and Boys." />
          ) : (
            <div className="space-y-6">
              {tree.map((root) => (
                <div key={root.category.id} className="border-t border-ink pt-3">
                  <Tree nodes={[root]} depth={0} selected={mode.kind === 'edit' ? mode.category.id : mode.parentId}
                    onEdit={(c) => setMode({ kind: 'edit', category: c })} onAdd={(c) => setMode({ kind: 'new', parentId: c.id })} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <Panel
            title={mode.kind === 'edit' ? `Edit ${mode.category.name}` : parentName ? `New in ${parentName}` : 'New category'}
            actions={mode.kind === 'new' && mode.parentId ? <button type="button" className="label text-muted hover:text-ink" onClick={() => setMode({ kind: 'new', parentId: null })}>Top level</button> : null}
          >
            <CategoryForm key={formKey} mode={mode} categories={categories.data} onDone={() => setMode({ kind: 'new', parentId: null })} />
          </Panel>
        </div>
      </div>
    </>
  );
}
