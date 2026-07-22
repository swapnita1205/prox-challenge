# WeldPilot Retrieval Evaluation Report

Generated: 2026-07-10T07:52:52.585Z

## Summary

| Metric | Value |
|--------|-------|
| Total cases | 7 |
| Passed | 7 |
| Failed | 0 |
| Pass rate | 100.0% |
| Average score | 54.8% |

## Corpus

Total documents: **1540**

| Corpus type | Count |
|-------------|-------|
| text_section | 681 |
| table | 50 |
| figure | 21 |
| warning | 37 |
| troubleshooting | 40 |
| polarity | 56 |
| settings | 1 |
| duty_cycle | 72 |
| graph_relationship | 582 |

## Case Results

### mig-duty-200a-240v — PASS

**Query:** What is the MIG duty cycle at 200 amps on 240V?

- Items retrieved: 15
- Ambiguities: 0
- Corpus types: duty_cycle, polarity, text_section, table, graph_relationship
- Pages cited: 7, 8, 14, 19, 21, 23
- Score: 67%

Top items:
- `owner-manual-p07-duty-2f6d5a479400` (duty_cycle, p7, score 1.501)
- `owner-manual-p14-polarity-5d0f42faaf52` (polarity, p14, score 0.939)
- `owner-manual-p23-page` (text_section, p23, score 1.044)
- `owner-manual-p19-page` (text_section, p19, score 1.036)
- `owner-manual-p14-section-5841ef24c5d3` (text_section, p14, score 1.018)

### tig-polarity-ground-clamp — PASS

**Query:** What polarity setup do I need for TIG, and where does the ground clamp go?

- Items retrieved: 17
- Ambiguities: 0
- Corpus types: text_section, polarity, graph_relationship
- Pages cited: 8, 13, 14, 17, 24, 25, 27, 31, 44
- Score: 50%

Top items:
- `owner-manual-p24-page` (text_section, p24, score 1.590)
- `owner-manual-p13-page` (text_section, p13, score 1.511)
- `owner-manual-p24-polarity-e20be9e1a4a5` (polarity, p24, score 1.392)
- `owner-manual-p27-polarity-9dada93abf6f` (polarity, p27, score 1.288)
- `owner-manual-p31-page` (text_section, p31, score 1.097)

### flux-porosity — PASS

**Query:** I'm getting porosity with flux-core wire — what should I check?

- Items retrieved: 12
- Ambiguities: 0
- Corpus types: troubleshooting, polarity, text_section, graph_relationship
- Pages cited: 8, 10, 12, 13, 22, 42, 43
- Score: 67%

Top items:
- `owner-manual-p43-trouble-004` (troubleshooting, p43, score 1.137)
- `owner-manual-p13-polarity-f571458e470b` (polarity, p13, score 1.031)
- `owner-manual-p13-polarity-097e8ac0ec63` (polarity, p13, score 1.030)
- `owner-manual-p13-page` (text_section, p13, score 1.072)
- `owner-manual-p42-page` (text_section, p42, score 0.958)

### wire-feed-tension — PASS

**Query:** How do I adjust wire feed tension on the OmniPro 220?

- Items retrieved: 11
- Ambiguities: 1
- Corpus types: troubleshooting, text_section, polarity, graph_relationship
- Pages cited: 9, 15, 23, 42
- Score: 50%

Top items:
- `owner-manual-p42-trouble-001` (troubleshooting, p42, score 0.942)
- `owner-manual-p09-page` (text_section, p9, score 1.161)
- `owner-manual-p09-polarity-91a842771b8f` (polarity, p9, score 1.010)
- `owner-manual-p23-section-49367d5ad470` (text_section, p23, score 0.967)
- `owner-manual-p15-page` (text_section, p15, score 0.868)

### front-panel-controls — PASS

**Query:** What are the front panel controls on the Vulcan OmniPro 220?

- Items retrieved: 11
- Ambiguities: 0
- Corpus types: text_section, polarity, table, figure
- Pages cited: 8, 13, 20, 23, 30, 32, 46
- Score: 50%

Top items:
- `owner-manual-p08-page` (text_section, p8, score 1.225)
- `owner-manual-p08-polarity-71fdcf473f02` (polarity, p8, score 1.065)
- `owner-manual-p08-section-36f873c1fb14` (text_section, p8, score 1.002)
- `owner-manual-p46-page` (text_section, p46, score 1.000)
- `owner-manual-p20-page` (text_section, p20, score 0.883)

### settings-recommendation — PASS

**Query:** What voltage and wire speed settings should I use for 1/8 inch mild steel MIG?

- Items retrieved: 19
- Ambiguities: 1
- Corpus types: polarity, settings, text_section, table, figure, graph_relationship
- Pages cited: 1, 6, 7, 8, 14, 20, 21, 23, 30, 37, 42, 43
- Score: 67%

Top items:
- `owner-manual-p14-polarity-5d0f42faaf52` (polarity, p14, score 1.045)
- `selection-chart-p01-settings-img` (settings, p1, score 0.797)
- `owner-manual-p14-section-5841ef24c5d3` (text_section, p14, score 1.052)
- `owner-manual-p20-page` (text_section, p20, score 1.046)
- `owner-manual-p37-page` (text_section, p37, score 0.991)

### ambiguous-weld-problem — PASS

**Query:** Something is wrong with my weld.

- Items retrieved: 15
- Ambiguities: 2
- Corpus types: text_section, polarity
- Pages cited: 34, 35, 38, 39, 40, 42, 43, 44
- Score: 33%

Top items:
- `owner-manual-p35-page` (text_section, p35, score 0.749)
- `owner-manual-p44-section-a1c5ae7bcb34` (text_section, p44, score 0.742)
- `owner-manual-p42-section-a1c5ae7bcb34` (text_section, p42, score 0.702)
- `owner-manual-p43-section-a1c5ae7bcb34` (text_section, p43, score 0.702)
- `owner-manual-p44-section-9d6a78aa7580` (text_section, p44, score 0.697)
