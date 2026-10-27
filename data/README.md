# Race data contract (planned)

Do not commit Torn API keys or raw responses. Normalized races must have one record per participant: driverId, status ('finished', 'crashed', or 'missed'), finish position and time for finishers, completion percentage for crashes. A validated group roster supplies the total number of registered racers for points calculation. The scoring engine rejects missing crash completion, duplicate finisher positions, and indistinguishable crash order rather than silently inventing points.

Regular and race-off standings are computed separately so race-off points reset. Group roster changes, penalties, ties and organizer corrections need audit and manual validation before publishing official-like standings.
