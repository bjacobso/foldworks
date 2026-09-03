export type FormField = Readonly<{
  id: string;
  type: string;
}>;

export type Actor = Readonly<{
  id: string;
  type: string;
  title: string;
}>;

export type Page<Field extends FormField> = Readonly<{
  id: string;
  title: string;
  description: string;
  fields: ReadonlyArray<Field>;
}>;

export type Section<Field extends FormField> = Readonly<{
  id: string;
  actorId: string;
  title: string;
  description: string;
  pages: ReadonlyArray<Page<Field>>;
}>;

export type FormDocument<Field extends FormField> = Readonly<{
  id: string;
  title: string;
  description: string;
  actors: ReadonlyArray<Actor>;
  sections: ReadonlyArray<Section<Field>>;
}>;

export type ItemKind = "Section" | "Page" | "Field";

export type SectionLocation = Readonly<{
  kind: "Section";
  index: number;
}>;

export type PageLocation = Readonly<{
  kind: "Page";
  sectionId: string;
  index: number;
}>;

export type FieldLocation = Readonly<{
  kind: "Field";
  pageId: string;
  index: number;
}>;

export type DropLocation = SectionLocation | PageLocation | FieldLocation;

export type LocatedPage<Field extends FormField> = Readonly<{
  section: Section<Field>;
  index: number;
  page: Page<Field>;
}>;

export type LocatedField<Field extends FormField> = Readonly<{
  section: Section<Field>;
  page: Page<Field>;
  index: number;
  field: Field;
}>;

export const findActor = <Field extends FormField>(
  document: FormDocument<Field>,
  actorId: string,
) => document.actors.find((actor) => actor.id === actorId);

export const findSection = <Field extends FormField>(
  document: FormDocument<Field>,
  sectionId: string,
) => document.sections.find((section) => section.id === sectionId);

export const locatePage = <Field extends FormField>(
  document: FormDocument<Field>,
  pageId: string,
): LocatedPage<Field> | undefined => {
  for (const section of document.sections) {
    const index = section.pages.findIndex((page) => page.id === pageId);
    const page = section.pages[index];
    if (page !== undefined) return { section, index, page };
  }
  return undefined;
};

export const findPage = <Field extends FormField>(
  document: FormDocument<Field>,
  pageId: string,
) => locatePage(document, pageId)?.page;

export const locateField = <Field extends FormField>(
  document: FormDocument<Field>,
  fieldId: string,
): LocatedField<Field> | undefined => {
  for (const section of document.sections) {
    for (const page of section.pages) {
      const index = page.fields.findIndex((field) => field.id === fieldId);
      const field = page.fields[index];
      if (field !== undefined) return { section, page, index, field };
    }
  }
  return undefined;
};

export const findField = <Field extends FormField>(
  document: FormDocument<Field>,
  fieldId: string,
) => locateField(document, fieldId)?.field;

export const allPages = <Field extends FormField>(document: FormDocument<Field>) =>
  document.sections.flatMap((section) => section.pages);

export const allFields = <Field extends FormField>(document: FormDocument<Field>) =>
  allPages(document).flatMap((page) => page.fields);

export const updateSection = <Field extends FormField>(
  document: FormDocument<Field>,
  sectionId: string,
  update: (section: Section<Field>) => Section<Field>,
): FormDocument<Field> => ({
  ...document,
  sections: document.sections.map((section) =>
    section.id === sectionId ? update(section) : section,
  ),
});

export const updatePage = <Field extends FormField>(
  document: FormDocument<Field>,
  pageId: string,
  update: (page: Page<Field>) => Page<Field>,
): FormDocument<Field> => ({
  ...document,
  sections: document.sections.map((section) => ({
    ...section,
    pages: section.pages.map((page) => page.id === pageId ? update(page) : page),
  })),
});

export const updateField = <Field extends FormField>(
  document: FormDocument<Field>,
  fieldId: string,
  update: (field: Field) => Field,
): FormDocument<Field> => ({
  ...document,
  sections: document.sections.map((section) => ({
    ...section,
    pages: section.pages.map((page) => ({
      ...page,
      fields: page.fields.map((field) => field.id === fieldId ? update(field) : field),
    })),
  })),
});

export const insertSection = <Field extends FormField>(
  document: FormDocument<Field>,
  location: SectionLocation,
  section: Section<Field>,
): FormDocument<Field> | undefined => {
  if (
    findSection(document, section.id) !== undefined ||
    location.index < 0 ||
    location.index > document.sections.length ||
    findActor(document, section.actorId) === undefined
  ) return undefined;
  return {
    ...document,
    sections: [
      ...document.sections.slice(0, location.index),
      section,
      ...document.sections.slice(location.index),
    ],
  };
};

export const insertPage = <Field extends FormField>(
  document: FormDocument<Field>,
  location: PageLocation,
  page: Page<Field>,
): FormDocument<Field> | undefined => {
  const section = findSection(document, location.sectionId);
  if (
    section === undefined ||
    findPage(document, page.id) !== undefined ||
    location.index < 0 ||
    location.index > section.pages.length
  ) return undefined;
  return updateSection(document, section.id, (target) => ({
    ...target,
    pages: [
      ...target.pages.slice(0, location.index),
      page,
      ...target.pages.slice(location.index),
    ],
  }));
};

export const insertField = <Field extends FormField>(
  document: FormDocument<Field>,
  location: FieldLocation,
  field: Field,
): FormDocument<Field> | undefined => {
  const page = findPage(document, location.pageId);
  if (
    page === undefined ||
    findField(document, field.id) !== undefined ||
    location.index < 0 ||
    location.index > page.fields.length
  ) return undefined;
  return updatePage(document, page.id, (target) => ({
    ...target,
    fields: [
      ...target.fields.slice(0, location.index),
      field,
      ...target.fields.slice(location.index),
    ],
  }));
};

export const deleteSection = <Field extends FormField>(
  document: FormDocument<Field>,
  sectionId: string,
): FormDocument<Field> | undefined =>
  findSection(document, sectionId) === undefined
    ? undefined
    : { ...document, sections: document.sections.filter((section) => section.id !== sectionId) };

export const deletePage = <Field extends FormField>(
  document: FormDocument<Field>,
  pageId: string,
): FormDocument<Field> | undefined => {
  const located = locatePage(document, pageId);
  return located === undefined
    ? undefined
    : updateSection(document, located.section.id, (section) => ({
        ...section,
        pages: section.pages.filter((page) => page.id !== pageId),
      }));
};

export const deleteField = <Field extends FormField>(
  document: FormDocument<Field>,
  fieldId: string,
): FormDocument<Field> | undefined => {
  const located = locateField(document, fieldId);
  return located === undefined
    ? undefined
    : updatePage(document, located.page.id, (page) => ({
        ...page,
        fields: page.fields.filter((field) => field.id !== fieldId),
      }));
};

const adjustedIndex = (sourceIndex: number, targetIndex: number, sameParent: boolean) =>
  sameParent && sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;

export const moveSection = <Field extends FormField>(
  document: FormDocument<Field>,
  sectionId: string,
  location: SectionLocation,
): FormDocument<Field> | undefined => {
  const sourceIndex = document.sections.findIndex((section) => section.id === sectionId);
  const section = document.sections[sourceIndex];
  if (section === undefined || location.index < 0 || location.index > document.sections.length) {
    return undefined;
  }
  const sections = document.sections.filter((_, index) => index !== sourceIndex);
  const index = adjustedIndex(sourceIndex, location.index, true);
  return { ...document, sections: [...sections.slice(0, index), section, ...sections.slice(index)] };
};

export const movePage = <Field extends FormField>(
  document: FormDocument<Field>,
  pageId: string,
  location: PageLocation,
): FormDocument<Field> | undefined => {
  const located = locatePage(document, pageId);
  const target = findSection(document, location.sectionId);
  if (located === undefined || target === undefined || location.index < 0 || location.index > target.pages.length) {
    return undefined;
  }
  const without = deletePage(document, pageId);
  if (without === undefined) return undefined;
  return insertPage(without, {
    ...location,
    index: adjustedIndex(located.index, location.index, located.section.id === location.sectionId),
  }, located.page);
};

export const moveField = <Field extends FormField>(
  document: FormDocument<Field>,
  fieldId: string,
  location: FieldLocation,
): FormDocument<Field> | undefined => {
  const located = locateField(document, fieldId);
  const target = findPage(document, location.pageId);
  if (located === undefined || target === undefined || location.index < 0 || location.index > target.fields.length) {
    return undefined;
  }
  const without = deleteField(document, fieldId);
  if (without === undefined) return undefined;
  return insertField(without, {
    ...location,
    index: adjustedIndex(located.index, location.index, located.page.id === location.pageId),
  }, located.field);
};

export const moveItem = <Field extends FormField>(
  document: FormDocument<Field>,
  kind: ItemKind,
  itemId: string,
  location: DropLocation,
): FormDocument<Field> | undefined => {
  if (kind !== location.kind) return undefined;
  if (kind === "Section" && location.kind === "Section") return moveSection(document, itemId, location);
  if (kind === "Page" && location.kind === "Page") return movePage(document, itemId, location);
  if (kind === "Field" && location.kind === "Field") return moveField(document, itemId, location);
  return undefined;
};

const LOCATION_PREFIX = "form-target:";

export const dropLocationId = (
  documentId: string,
  location: DropLocation,
  surfaceId?: string,
): string => {
  const suffix = surfaceId === undefined ? "" : `:${encodeURIComponent(surfaceId)}`;
  if (location.kind === "Section") {
    return `${LOCATION_PREFIX}section:${encodeURIComponent(documentId)}:${location.index}${suffix}`;
  }
  if (location.kind === "Page") {
    return `${LOCATION_PREFIX}page:${encodeURIComponent(location.sectionId)}:${location.index}${suffix}`;
  }
  return `${LOCATION_PREFIX}field:${encodeURIComponent(location.pageId)}:${location.index}${suffix}`;
};

export const dropLocationFromId = (id: string): DropLocation | undefined => {
  if (!id.startsWith(LOCATION_PREFIX)) return undefined;
  const [kind, encodedParentId, rawIndex] = id.slice(LOCATION_PREFIX.length).split(":");
  const index = Number(rawIndex);
  if (encodedParentId === undefined || !Number.isInteger(index) || index < 0) return undefined;
  const parentId = decodeURIComponent(encodedParentId);
  if (kind === "section") return { kind: "Section", index };
  if (kind === "page") return { kind: "Page", sectionId: parentId, index };
  if (kind === "field") return { kind: "Field", pageId: parentId, index };
  return undefined;
};

export const dragItemId = (kind: ItemKind, id: string) =>
  `form-item:${kind.toLowerCase()}:${encodeURIComponent(id)}`;

export const dragItemFromId = (value: string): Readonly<{ kind: ItemKind; id: string }> | undefined => {
  const [prefix, rawKind, encodedId] = value.split(":");
  if (prefix !== "form-item" || encodedId === undefined) return undefined;
  const kind = rawKind === "section" ? "Section" : rawKind === "page" ? "Page" : rawKind === "field" ? "Field" : undefined;
  return kind === undefined ? undefined : { kind, id: decodeURIComponent(encodedId) };
};
