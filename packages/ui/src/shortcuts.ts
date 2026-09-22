import * as Keyboard from "@foldworks/keyboard";
import { Schema as S, Stream } from "effect";
import { Mount } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import type { HtmlBuilder } from "foldkit/html";
import { sxAttrs } from "./sx";
import { desktopStyles as styles } from "./desktop.styles";
export * from "@foldworks/keyboard";
export const Message = defineMessageUnion({ Invoked: { id: S.String } });
export const Register = Mount.defineStream("RegisterKeyboardCommands", {
  args: { bindings: S.Array(Keyboard.Binding), platform: Keyboard.Platform },
  messages: [Message.Invoked],
  execute: ({ bindings, platform, element }) =>
    Keyboard.events(() => (element.isConnected ? bindings : []), platform).pipe(
      Stream.map((id) => Message.Invoked({ id })),
    ),
});
/** Insert a keyed marker so changing bindings replaces the stream without remounting controls. */
export const registration = <ParentMessage>(
  config: Readonly<{
    bindings: ReadonlyArray<Keyboard.Binding>;
    platform: Keyboard.Platform;
    toParentMessage: (message: typeof Message.Type) => ParentMessage;
  }>,
  h: HtmlBuilder<ParentMessage>,
) =>
  h.span(
    [
      h.Key(JSON.stringify([config.platform, config.bindings])),
      h.Hidden(true),
      h.OnMount(
        Mount.mapMessage(
          Register({ bindings: config.bindings, platform: config.platform }),
          config.toParentMessage,
        ),
      ),
    ],
    [],
  );
export const reference = <Message>(
  config: Readonly<{
    bindings: ReadonlyArray<Keyboard.Binding>;
    platform: Keyboard.Platform;
    onInvoke: (id: string) => Message;
  }>,
  h: HtmlBuilder<Message>,
) =>
  h.dl(
    sxAttrs(h, styles.column),
    config.bindings.map((binding) =>
      h.div(sxAttrs(h, styles.row), [
        h.dt(
          [],
          [
            h.button(
              [
                h.Type("button"),
                h.Disabled(binding.isDisabled === true),
                h.AriaKeyshortcuts(
                  Keyboard.aria(binding.shortcut, config.platform),
                ),
                h.OnClick(config.onInvoke(binding.id)),
                ...sxAttrs(h, styles.button),
              ],
              [binding.label],
            ),
          ],
        ),
        h.dd(sxAttrs(h, styles.muted), [
          h.kbd([], [Keyboard.display(binding.shortcut, config.platform)]),
          binding.scope ? ` · ${binding.scope}` : " · Global",
        ]),
      ]),
    ),
  );
