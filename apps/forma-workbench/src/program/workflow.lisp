; Typed workflow forms. Patterns describe authoring; IR types describe artifacts.

(type StepIR
  {:kind "Step" :name Symbol :system String
   :reads (List Keyword) :writes (List Keyword) :doc (Option String)})

(form (step name {:keys [system reads writes doc]})
  "A unit of work performed by an external system."
  :types {:name (Declares Step) :system String
          :reads (Option (List Keyword)) :writes (Option (List Keyword))
          :doc (Option String)}
  :ir StepIR
  {:kind "Step" :name name :system system
   :reads (or reads []) :writes (or writes []) :doc doc})

(type StepRefIR {:kind "step" :step Symbol})
(type ParallelIR {:kind "parallel" :items (List flow)})
(type SequenceIR {:kind "sequence" :items (List flow)})
(type flow (Union StepRefIR ParallelIR SequenceIR))

(form (use name)
  "Run a declared step."
  :types {:name (Refers Step)}
  :ir StepRefIR
  {:kind "step" :step name})

(form (parallel item ...)
  "Run child flows concurrently."
  :types {:item (List flow)}
  :ir ParallelIR
  {:kind "parallel" :items item})

(form (sequence item ...)
  "Run child flows in order."
  :types {:item (List flow)}
  :ir SequenceIR
  {:kind "sequence" :items item})

(type WorkflowIR
  {:kind "Workflow" :name Symbol :flow SequenceIR :doc (Option String)})

(form (workflow name {:keys [doc]} item ...)
  "An ordered flow of steps."
  :types {:name (Declares Workflow) :doc (Option String) :item (List flow)}
  :ir WorkflowIR
  {:kind "Workflow" :name name :flow {:kind "sequence" :items item} :doc doc})
