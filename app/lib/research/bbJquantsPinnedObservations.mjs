// Pinned research snapshot of six BB observations from the DEV database.
// Read-only and deliberately isolated from production data and AI.
export const observations = [
{code:"8591",observation_date:"2026-08-21",evaluated_trade_date:"2026-08-28",entry_price:6115,future_close:6218,return_percent:1.6843826655764516},
{code:"8591",observation_date:"2026-08-21",evaluated_trade_date:"2026-08-28",entry_price:6115,future_close:6218,return_percent:1.6843826655764516},
{code:"9432",observation_date:"2026-08-21",evaluated_trade_date:"2026-08-28",entry_price:166.10000610351562,future_close:168.60000610351562,return_percent:1.5051173438500467},
{code:"9983",observation_date:"2026-08-21",evaluated_trade_date:"2026-08-28",entry_price:73510,future_close:71260,return_percent:-3.0608080533260784},
{code:"9983",observation_date:"2026-08-21",evaluated_trade_date:"2026-08-28",entry_price:73510,future_close:71260,return_percent:-3.0608080533260784},
{code:"9983",observation_date:"2026-08-28",evaluated_trade_date:"2026-09-04",entry_price:71260,future_close:69100,return_percent:-3.031153522312658},
].map(row=>Object.freeze({...row,provider:"YAHOO_CHART",horizon:5,horizon_unit:"TRADING_DAY"}));
