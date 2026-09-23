import type { Html, HtmlBuilder } from "foldkit/html";

import type { ActionIntent, Element, Spec } from "./model";

export type RenderContext<Message> = Readonly<{
  id: string;
  element: Element;
  props: Readonly<Record<string, unknown>>;
  children: ReadonlyArray<Html>;
  emit: (event: string) => Message | undefined;
}>;

export type ComponentRenderer<Message> = (
  context: RenderContext<Message>,
  h: HtmlBuilder<Message>,
) => Html;

export type Registry<Message> = Readonly<Record<string, ComponentRenderer<Message>>>;

export type RenderConfig<Message> = Readonly<{
  spec: Spec;
  registry: Registry<Message>;
  toMessage: (intent: ActionIntent) => Message;
  renderError?: (message: string, h: HtmlBuilder<Message>) => Html;
}>;

const defaultError = <Message>(message: string, h: HtmlBuilder<Message>): Html =>
  h.div([h.Role("alert")], [message]);

/** Render only registered components; interaction bindings become inert host messages. */
export const render = <Message>(config: RenderConfig<Message>, h: HtmlBuilder<Message>): Html => {
  const fallback = config.renderError ?? defaultError;
  const active = new Set<string>();
  const element = (id: string): Html => {
    if (active.has(id)) return fallback(`Generative UI cycle at ${id}.`, h);
    const node = config.spec.elements[id];
    if (node === undefined) return fallback(`Missing generative UI element: ${id}.`, h);
    const component = config.registry[node.type];
    if (component === undefined)
      return fallback(`Unsupported generative UI component: ${node.type}.`, h);
    active.add(id);
    const children = node.children
      .map(element)
      .filter((child): child is Exclude<Html, null> => child !== null);
    active.delete(id);
    return component(
      {
        id,
        element: node,
        props: node.props,
        children,
        emit: (event) => {
          const binding = node.on?.[event];
          return binding === undefined
            ? undefined
            : config.toMessage({
                action: binding.action,
                elementId: id,
                event,
                params: binding.params ?? {},
              });
        },
      },
      h,
    );
  };
  return element(config.spec.root);
};
