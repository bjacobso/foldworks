import { Runtime } from "foldkit";
import { Message } from "./message";
import { init, Model } from "./model";
import { exposeSamples, slowConfig } from "./performance";
import { update } from "./update";
import { formApp } from "./form-view";
import { className, styles } from "./styles";

/**
 * The candidate form as its own application, without the demo shell. This is
 * the build the payload and interaction benchmarks measure.
 */
exposeSamples();

const application = Runtime.makeApplication({
  Model,
  init: () => update(init(), Message.Initialize()),
  update,
  view: (model, h) => ({
    title: "Apply · Foldworks",
    body: h.main([h.Class(className(styles.standalone))], [formApp(model, h)]),
  }),
  container: document.getElementById("root"),
  slow: slowConfig(),
});

Runtime.run(application);
