import { Runtime } from 'foldkit'

import {
  Message,
  Model,
  init,
  subscriptions,
  update,
  view,
} from './main'

const application = Runtime.makeApplication({
  Model,
  init,
  update,
  view,
  subscriptions,
  container: document.getElementById('root'),
  routing: {
    onUrlRequest: request => Message.ClickedLink({ request }),
    onUrlChange: url => Message.ChangedUrl({ url }),
  },
  devTools: {
    Message,
    show: 'Development',
    position: 'BottomRight',
  },
  viewTransition: ({ previousModel, model }) =>
    previousModel.revision !== model.revision,
})

Runtime.run(application)
