# Result alert URL fields

The result Web Push URL carries the historical monitor snapshot required to explain the notification:

- `result`: WIN or LOSE
- `name`: stock name
- `entry`: stored entry price
- `takeProfit`: stored take-profit line
- `stopLoss`: stored stop-loss line
- `resultPrice`: price recorded when the monitor completed
- `triggeredAt`: monitor start timestamp
- `completedAt`: monitor completion timestamp

These values explain the notification only. They are not substituted for the current `/analysis/{code}` scan.
