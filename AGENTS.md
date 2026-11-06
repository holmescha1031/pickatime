# Project conventions and user preferences

- Keep existing polls and stored votes compatible. Use the staged release script; do not change DB rules during ordinary API requests or a routine UI release.
- Give content and action buttons deliberate spacing by default. Use the shared `dialog-stack` layout (24px gap) for new or updated stacked modal sections; do not rely on incidental paragraph/figure margins. Prevent duplicate CSS rules from silently cancelling spacing. Check rendered mobile spacing when changing dialogs.
- In the Korean product UI, write “구글” consistently, including “구글 캘린더 연결하기”. Keep actual API identifiers, domains, OAuth scopes, and English policy text intact.
- Connection dialogs show one explanatory/status message at a time. Once connection is attempted, hide the introductory account explanation and show the current progress/error instead.
- Render compact examples directly in HTML/CSS where practical, avoiding an extra screenshot download and keeping text sharp. Example content must be fictional and visually isolated from interactive voting controls.
- Place the meeting-date confirmation action outside the ranked date cards, right-aligned above the list; do not put it inside the first-ranked card.
- Keep the cross-poll import action as a compact pill on the left of the save-status row; keep the save status on the right. Show the drag hint below the sticker legend.
- On the signed-in home screen, use inline “모임 생성 / 모임 목록 보기” tabs; keep guest creation simple. Switching tabs or restoring a session must preserve in-progress inputs. List unconfirmed meetings by the displayed candidate date, then place confirmed meetings below them.
- Day/trip kind choices have no subtitles. Use the same editable number stepper for participant count and trip days, with space before the date-range section. Keep missing-field notices brief and specific.
