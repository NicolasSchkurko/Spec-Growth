# Conformance token usage

DB: C:\Users\Luzbelito-WrkLp\.local\share\opencode\opencode.db

| task | run | agent in | agent out | cache read | cache write | agent total | judge total | agent session | started |
|---|---|---|---|---|---|---|---|---|---|
| t1-add | run1 | 58250 | 4802 | 323328 | 0 | 396377 | 41837 | ses_eb98a1fc0ffezkbeUVL0AUy9dE | 10-16 20:44 |
| t1-add | run2 | 65132 | 5459 | 615168 | 0 | 697021 | 15825 | ses_eb98a1c6effec5X9jmWO2WQQVL | 10-16 20:44 |
| t1-add | run3 | 76366 | 6648 | 1245696 | 0 | 1345109 | 34882 | ses_eb98a18e3ffeYdTbG4KOJSVcYA | 10-16 20:44 |
| t1-add | run4 | 81756 | 4942 | 915072 | 0 | 1020889 | 15429 | ses_eb9887ce2ffeh8Wym35tSYsTm8 | 10-16 20:46 |
| t1-add | run5 | 48309 | 5033 | 545024 | 0 | 609733 | 15513 | ses_eb9883379ffev1Dp9T2AQHsLgM | 10-16 20:46 |
| t2-quickfix | run1 | 66394 | 5774 | 1075456 | 0 | 1164329 | 0 | ses_eb9873507ffe4ipJ6uoFscujrS | 10-16 20:48 |
| t2-quickfix | run2 | 63002 | 6175 | 1069696 | 0 | 1152237 | 0 | ses_eb9865722ffeCVIAhLfaW46NSE | 10-16 20:49 |
| t2-quickfix | run3 | 61809 | 6076 | 1205760 | 0 | 1285674 | 0 | ses_eb985ef18ffeXm9ij5sVoSPePZ | 10-16 20:49 |
| t2-quickfix | run4 | 44212 | 4560 | 671232 | 0 | 726444 | 0 | ses_eb984a7f9ffeRrwpwpEavkp4qT | 10-16 20:50 |
| t2-quickfix | run5 | 55998 | 6522 | 1843456 | 0 | 1918477 | 0 | ses_eb983f5f5ffeLHtRa9bOtsCnAk | 10-16 20:51 |
| t3-apply | run1 | 105518 | 6822 | 2256512 | 0 | 2399817 | 0 | ses_eb9839d11ffe4S8vDDTs1YQXRS | 10-16 20:51 |
| t3-apply | run2 | 35520 | 7866 | 1644160 | 0 | 1713326 | 0 | ses_eb98311d2ffeORMCLE1ce9Xlg9 | 10-16 20:52 |
| t3-apply | run3 | 78240 | 6531 | 1757184 | 0 | 1862659 | 0 | ses_eb980ee1dffenPkP5p6p9XlLix | 10-16 20:54 |
| t4-archive | run1 | 26727 | 2649 | 231296 | 0 | 264172 | 16145 | ses_eb97f7f5effewRwa0PJKYcWEdh | 10-16 20:56 |
| t4-archive | run2 | 24941 | 2525 | 200704 | 0 | 231943 | 16058 | ses_eb97eff10ffek9JTm4HyScVtQJ | 10-16 20:57 |
| t4-archive | run3 | 19139 | 3276 | 257792 | 0 | 284595 | 16161 | ses_eb97e8782ffe1eb8h7oi1zoO2Y | 10-16 20:57 |
| t4-archive | run4 | 21138 | 3485 | 350080 | 0 | 379045 | 16595 | ses_eb97e12d0ffem09XaIv6RAIBjH | 10-16 20:58 |
| t4-archive | run5 | 33466 | 3552 | 302720 | 0 | 346450 | 16408 | ses_eb97dbf14ffe4TgK4T4Oe1RUaO | 10-16 20:58 |
| t5-explain | run1 | 15004 | 2092 | 69120 | 0 | 86790 | 27470 | ses_eb97d584bffel5fG5tuco2ZUAz | 10-16 20:58 |
| t5-explain | run2 | 15171 | 2542 | 55552 | 0 | 74088 | 18878 | ses_eb97ccdf7ffeTalK30daKmf8hb | 10-16 20:59 |
| t5-explain | run3 | 11513 | 2374 | 58880 | 0 | 73784 | 40763 | ses_eb97cc7dfffevLPPLxCLUyL37T | 10-16 20:59 |

## Per task (mean per run)

| task | runs | mean agent total | mean judge total |
|---|---|---|---|
| t1-add | 5 | 813826 | 24697 |
| t2-quickfix | 5 | 1249432 | 0 |
| t3-apply | 3 | 1991934 | 0 |
| t4-archive | 5 | 301241 | 16273 |
| t5-explain | 3 | 78221 | 29037 |
