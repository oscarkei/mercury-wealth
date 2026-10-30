#!/usr/bin/env python3
"""Check source/fixture consistency only; do not call a model or the Mercury app."""
import json
import re
from decimal import Decimal
from pathlib import Path


def check(root):
    checks = []

    def require(condition, label):
        if not condition:
            raise ValueError(label)
        checks.append(label)

    def load(relative):
        return json.loads((root / relative).read_text(encoding="utf-8"))

    manifest = load("manifest.json")
    tool_map = load(manifest["tool_map"])
    tool_ids = {t["id"] for t in tool_map["tools"]}
    require(len(tool_ids) == len(tool_map["tools"]), "Tool IDs are unique")
    require(len(manifest["skills"]) == 4, "Four skills are declared")
    require(manifest["status"] == "source_only_not_integrated", "Integration status is explicit")
    for relative in manifest["shared"] + [manifest["contract"], manifest["evaluations"], manifest["provenance"]]:
        require((root / relative).is_file(), "Manifest path exists: " + relative)
    skill_ids = set()
    for skill in manifest["skills"]:
        text = (root / skill["path"]).read_text(encoding="utf-8")
        require(text.startswith("---\n"), skill["id"] + ": frontmatter exists")
        front = text.split("---\n", 2)[1]
        fields = dict(line.split(":", 1) for line in front.splitlines() if ":" in line)
        require(set(fields) == {"name", "description"}, skill["id"] + ": minimal metadata")
        require(fields["name"].strip() == skill["id"], skill["id"] + ": name matches")
        require(bool(re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", skill["id"])), skill["id"] + ": valid name")
        require(len(fields["description"].strip()) <= 1024, skill["id"] + ": description bound")
        require(len(text.splitlines()) < 500, skill["id"] + ": lean instructions")
        require((root / skill["path"]).parent.joinpath("references/examples.md").is_file(), skill["id"] + ": examples exist")
        require(set(skill["tools"] + skill["planned_tools"]) <= tool_ids, skill["id"] + ": tool IDs resolve")
        skill_ids.add(skill["id"])
    for tool in tool_map["tools"]:
        if tool["status"] == "planned_adapter":
            require(tool["enabled"] is False, tool["id"] + ": planned capability disabled")
        else:
            require(tool["live_verified"] is False, tool["id"] + ": no invented live verification")
    contract = load(manifest["contract"])
    require(contract["additionalProperties"] is False, "Response contract rejects undeclared top-level fields")
    for definition in ["section", "component", "metric"]:
        require(definition in contract["$defs"], "Contract definition exists: " + definition)
    provenance = load(manifest["provenance"])
    require(len(provenance["sources"]) == 4, "Four pinned upstream sources recorded")
    require(all(re.fullmatch(r"[a-f0-9]{40}", s["commit"]) for s in provenance["sources"]), "Upstream commits are immutable references")
    require((root / "LICENSES/Apache-2.0.txt").is_file(), "Upstream license retained")
    require((root / "THIRD_PARTY_NOTICES.md").is_file(), "Adaptation attribution retained")
    evaluations = load(manifest["evaluations"])
    cases = evaluations["cases"]
    require(len(cases) == 20 and len({c["id"] for c in cases}) == 20, "Twenty unique acceptance cases")
    require(all(c["status"] == "not_run" for c in cases), "Acceptance cases are not mislabeled as passed")
    require(all(set(c["skills"]) <= skill_ids for c in cases), "Acceptance skill references resolve")
    require(all(c["fixture"] in evaluations["fixtures"] for c in cases), "Acceptance fixture references resolve")
    require(all(c["must"] and c["must_not"] for c in cases), "Every case has positive and negative criteria")
    require(len(evaluations["mixed_topic_sequence"]) >= 20, "Long conversation sequence is defined")
    fixture = evaluations["fixtures"]["base"]
    require(fixture["synthetic"] and fixture["independent_of_current_demo"], "Fixtures cannot be mistaken for live demo facts")
    d = lambda value: Decimal(str(value))
    total = sum(d(h["value"]) for h in fixture["holdings"])
    require(total == d(fixture["nav"]), "Fixture holdings reconcile with NAV")
    direct = sum(d(h["value"]) for h in fixture["holdings"] if h["instrument"] == "NVDA")
    fund = next(h for h in fixture["holdings"] if h["instrument"] == "TECHF")
    weights = fixture["fund_constituents"]["TECHF"]["weights"]
    require(sum(d(v) for v in weights.values()) == 1, "Fund constituent weights reconcile")
    indirect = d(fund["value"]) * d(weights["NVDA"])
    expected = fixture["expected"]
    require(direct == d(expected["direct_nvda_value"]), "Direct-exposure acceptance value is consistent")
    require(indirect == d(expected["indirect_nvda_value"]), "Indirect-exposure acceptance value is consistent")
    require(direct + indirect == d(expected["known_nvda_equity_value"]), "Known exposure excludes nonlinear note linkage")
    require((direct + indirect) / total == d(expected["known_nvda_equity_weight"]), "Exposure denominator is consistent")
    require((direct + indirect) * d(-0.2) == d(expected["nvda_equity_shock_minus_20_pnl"]), "Linear shock expectation is consistent")
    sector = sum(d(h["value"]) for h in fixture["holdings"] if h.get("sector") == "technology")
    require(sector * d(-0.2) == d(expected["technology_linear_shock_minus_20_pnl"]), "Sector scenario expectation excludes note repricing")
    note = evaluations["fixtures"]["note_final"]
    for terminal in (60, 50):
        redemption = d(note["principal"]) if terminal >= note["barrier"] else d(note["principal"]) * d(terminal) / d(note["strike"])
        require(redemption == d(note["expected_terminal_%s_redemption" % terminal]), "Synthetic note terminal %s expectation is consistent" % terminal)
    return {"status": "passed", "source_checks": len(checks), "skills": 4, "acceptance_cases_defined": 20, "live_cases_run": 0, "checks": checks}


if __name__ == "__main__":
    print(json.dumps(check(Path(__file__).resolve().parents[1]), indent=2))
