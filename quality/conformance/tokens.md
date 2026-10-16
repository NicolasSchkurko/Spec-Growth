# Conformance token usage

DB: C:\Users\Luzbelito-WrkLp\.local\share\opencode\opencode.db

| task | run | agent in | agent out | cache read | cache write | agent total | judge total | agent session | started |
|---|---|---|---|---|---|---|---|---|---|
| t1-add | run1 | 55033 | 5261 | 293248 | 0 | 363499 | 23047 | ses_eb96e264cffeYBKOGJveTmNup9 | 10-16 21:15 |
| t1-add | run2 | 54485 | 4975 | 405632 | 0 | 476711 | 22471 | ses_eb96e24c6ffew3DdUQpL4eWgXu | 10-16 21:15 |
| t1-add | run3 | 41240 | 4984 | 426368 | 0 | 481235 | 23269 | ses_eb96e2318ffeRrSCP0iUjiq4J7 | 10-16 21:15 |
| t1-add | run4 | 78899 | 8492 | 1511936 | 0 | 1618755 | 14704 | ses_eb96c7795ffevmN5BjktwQX0Oh | 10-16 21:17 |
| t1-add | run5 | 54213 | 5381 | 541696 | 0 | 611895 | 14789 | ses_eb96c5b1cffexMJblwMKyGrFic | 10-16 21:17 |
| t2-quickfix | run1 | 14979 | 924 | 69632 | 0 | 87964 | 0 | ses_eb96c4176ffe668j0OKGXVRWuM | 10-16 21:17 |
| t2-quickfix | run2 | 47232 | 4486 | 654720 | 0 | 718861 | 0 | ses_eb96bc701ffeNJ23IVUQO906xp | 10-16 21:18 |
| t2-quickfix | run3 | 42411 | 3869 | 531456 | 0 | 591574 | 0 | ses_eb96a8cf7ffe50kPygh0KLjDYA | 10-16 21:19 |
| t2-quickfix | run4 | 9783 | 1430 | 105984 | 0 | 118901 | 0 | ses_eb969d8bbffe8IbuRH0yey3C5C | 10-16 21:20 |
| t2-quickfix | run5 | 55191 | 4324 | 586368 | 0 | 659090 | 0 | ses_eb9694ed7ffe9U4cpRZ0cJlnjF | 10-16 21:20 |
| t3-apply | run1 | 60489 | 9472 | 1504256 | 0 | 1590792 | 0 | ses_eb9689ed5ffercCvgjBysllJwm | 10-16 21:21 |
| t3-apply | run2 | 62954 | 7735 | 1248384 | 0 | 1334694 | 0 | ses_eb9687fe8ffet42qbJql2BKcLK | 10-16 21:21 |
| t3-apply | run3 | 84913 | 6518 | 1728768 | 0 | 1850228 | 0 | ses_eb96770a0ffedgZopH6R1npErA | 10-16 21:22 |
| t4-archive | run1 | 24281 | 4229 | 249984 | 0 | 284796 | 16463 | ses_eb965eb2dffe6sIIGJcLtxMlkj | 10-16 21:24 |
| t4-archive | run2 | 28575 | 3462 | 324864 | 0 | 365340 | 14639 | ses_eb965a6acffevS4rJv1FAk5S0Y | 10-16 21:24 |
| t4-archive | run3 | 26142 | 3468 | 278272 | 0 | 312645 | 16088 | ses_eb96468b3ffeGQ5De7rApCdZzh | 10-16 21:26 |
| t4-archive | run4 | 22190 | 2136 | 201216 | 0 | 231576 | 14484 | ses_eb9642465ffeDtPqaoQgkQ30Tr | 10-16 21:26 |
| t4-archive | run5 | 26575 | 3170 | 261760 | 0 | 297650 | 15425 | ses_eb9639612fferwoopM3OD3CP5z | 10-16 21:26 |
| t5-explain | run1 | 15997 | 2228 | 77952 | 0 | 97472 | 24744 | ses_eb96330d7ffeE3q48mqLI3xp6l | 10-16 21:27 |
| t5-explain | run2 | 12440 | 2600 | 47360 | 0 | 63299 | 17424 | ses_eb96311a3ffen8BHp04Ck2Y4wN | 10-16 21:27 |
| t5-explain | run3 | 10076 | 2004 | 48128 | 0 | 61100 | 17275 | ses_eb962a638ffek0odb54sbgUgW8 | 10-16 21:28 |

## Per task (mean per run)

| task | runs | mean agent total | mean judge total |
|---|---|---|---|
| t1-add | 5 | 710419 | 19656 |
| t2-quickfix | 5 | 435278 | 0 |
| t3-apply | 3 | 1591905 | 0 |
| t4-archive | 5 | 298401 | 15420 |
| t5-explain | 3 | 73957 | 19814 |
