export const ledgerSample = `;; A tiny spending ledger. Results appear beside each form as you type.
;; Cmd/Ctrl+Enter evaluates the form at the cursor into the REPL.

(def raw
  "2026-10-01,coffee,4.50
2026-10-01,groceries,62.10
2026-10-02,coffee,4.75
2026-10-03,books,18.00
2026-10-04,coffee,5.25
2026-10-04,groceries,23.40")

(defn parse-row [line]
  (let [[date category amount] (str/split line #",")]
    {:date date
     :category (keyword category)
     :amount (parse-double amount)}))

(def rows (mapv parse-row (str/split-lines raw)))

(defn total [rows]
  (reduce + (map :amount rows)))

(total rows)

(->> rows
     (group-by :category)
     (map (fn [[category items]]
            {:category category
             :count (count items)
             :spent (total items)}))
     (sort-by :spent)
     reverse)

(comment
  ;; Rich comment: evaluate these one at a time with Cmd/Ctrl+Enter.
  (parse-row "2026-10-05,tea,3.10")
  (filter #(= :coffee (:category %)) rows)
  (parse-row "oops"))
`;
