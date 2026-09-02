export type Flow<Node> = Readonly<{
  id: string;
  label: string;
  elements: ReadonlyArray<Node>;
}>;

export type ElementShape<Node> = Readonly<{
  id: string;
  type: string;
  branches: ReadonlyArray<Flow<Node>>;
}>;

export type WorkflowDocument<Node> = Readonly<{
  root: Flow<Node>;
}>;

export type FlowLocation = Readonly<{
  flowId: string;
  index: number;
}>;

export type LocatedElement<Node> = Readonly<{
  flow: Flow<Node>;
  index: number;
  element: Node;
}>;

export type StructuredWorkflowOperationsConfig<Node> = Readonly<{
  isMovable?: (node: Node) => boolean;
  isDeletable?: (node: Node) => boolean;
}>;

const mapFlow = <Node extends ElementShape<Node>>(
  flow: Flow<Node>,
  update: (flow: Flow<Node>) => Flow<Node>,
): Flow<Node> =>
  update({
    ...flow,
    elements: flow.elements.map((element) => ({
      ...element,
      branches: element.branches.map((branch) => mapFlow(branch, update)),
    })),
  });

const descendantFlowIds = <Node extends ElementShape<Node>>(
  node: Node,
): ReadonlySet<string> => {
  const ids = new Set<string>();
  const visit = (flow: Flow<Node>) => {
    ids.add(flow.id);
    for (const element of flow.elements) {
      for (const branch of element.branches) visit(branch);
    }
  };
  for (const branch of node.branches) visit(branch);
  return ids;
};

export const createStructuredWorkflowOperations = <
  Node extends ElementShape<Node>,
>(config: StructuredWorkflowOperationsConfig<Node> = {}) => {
  const isMovable = config.isMovable ?? (() => true);
  const isDeletable = config.isDeletable ?? isMovable;

  const findFlow = (
    document: WorkflowDocument<Node>,
    flowId: string,
  ): Flow<Node> | undefined => {
    const visit = (flow: Flow<Node>): Flow<Node> | undefined => {
      if (flow.id === flowId) return flow;
      for (const element of flow.elements) {
        for (const branch of element.branches) {
          const found = visit(branch);
          if (found !== undefined) return found;
        }
      }
      return undefined;
    };
    return visit(document.root);
  };

  const locateElement = (
    document: WorkflowDocument<Node>,
    elementId: string,
  ): LocatedElement<Node> | undefined => {
    const visit = (flow: Flow<Node>): LocatedElement<Node> | undefined => {
      for (const [index, element] of flow.elements.entries()) {
        if (element.id === elementId) return { flow, index, element };
        for (const branch of element.branches) {
          const found = visit(branch);
          if (found !== undefined) return found;
        }
      }
      return undefined;
    };
    return visit(document.root);
  };

  const findElement = (
    document: WorkflowDocument<Node>,
    elementId: string,
  ): Node | undefined => locateElement(document, elementId)?.element;

  const updateFlow = (
    document: WorkflowDocument<Node>,
    flowId: string,
    update: (flow: Flow<Node>) => Flow<Node>,
  ): WorkflowDocument<Node> | undefined => {
    if (findFlow(document, flowId) === undefined) return undefined;
    return { root: mapFlow(document.root, (flow) => flow.id === flowId ? update(flow) : flow) };
  };

  const insertElement = (
    document: WorkflowDocument<Node>,
    location: FlowLocation,
    element: Node,
  ): WorkflowDocument<Node> | undefined => {
    if (findElement(document, element.id) !== undefined) return undefined;
    const flow = findFlow(document, location.flowId);
    if (
      flow === undefined ||
      location.index < 0 ||
      location.index > flow.elements.length
    ) {
      return undefined;
    }
    return updateFlow(document, location.flowId, (target) => ({
      ...target,
      elements: [
        ...target.elements.slice(0, location.index),
        element,
        ...target.elements.slice(location.index),
      ],
    }));
  };

  const deleteElement = (
    document: WorkflowDocument<Node>,
    elementId: string,
  ): WorkflowDocument<Node> | undefined => {
    const located = locateElement(document, elementId);
    if (located === undefined || !isDeletable(located.element)) return undefined;
    return updateFlow(document, located.flow.id, (flow) => ({
      ...flow,
      elements: flow.elements.filter((_, index) => index !== located.index),
    }));
  };

  const moveElement = (
    document: WorkflowDocument<Node>,
    elementId: string,
    requestedLocation: FlowLocation,
  ): WorkflowDocument<Node> | undefined => {
    const located = locateElement(document, elementId);
    const target = findFlow(document, requestedLocation.flowId);
    if (
      located === undefined ||
      target === undefined ||
      !isMovable(located.element) ||
      requestedLocation.index < 0 ||
      requestedLocation.index > target.elements.length ||
      descendantFlowIds(located.element).has(requestedLocation.flowId)
    ) {
      return undefined;
    }

    const withoutElement = updateFlow(document, located.flow.id, (flow) => ({
      ...flow,
      elements: flow.elements.filter((_, index) => index !== located.index),
    }));
    if (withoutElement === undefined) return undefined;

    const adjustedIndex =
      located.flow.id === requestedLocation.flowId &&
      located.index < requestedLocation.index
        ? requestedLocation.index - 1
        : requestedLocation.index;

    return updateFlow(withoutElement, requestedLocation.flowId, (flow) => ({
      ...flow,
      elements: [
        ...flow.elements.slice(0, adjustedIndex),
        located.element,
        ...flow.elements.slice(adjustedIndex),
      ],
    }));
  };

  const updateElement = (
    document: WorkflowDocument<Node>,
    elementId: string,
    update: (element: Node) => Node,
  ): WorkflowDocument<Node> => ({
    root: mapFlow(document.root, (flow) => ({
      ...flow,
      elements: flow.elements.map((element) =>
        element.id === elementId ? update(element) : element,
      ),
    })),
  });

  const elements = (document: WorkflowDocument<Node>): ReadonlyArray<Node> => {
    const result: Node[] = [];
    const visit = (flow: Flow<Node>) => {
      for (const element of flow.elements) {
        result.push(element);
        for (const branch of element.branches) visit(branch);
      }
    };
    visit(document.root);
    return result;
  };

  return {
    deleteElement,
    elements,
    findElement,
    findFlow,
    insertElement,
    locateElement,
    moveElement,
    updateElement,
  } as const;
};
