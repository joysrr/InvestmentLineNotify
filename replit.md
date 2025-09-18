# LINE ETF Notify - Daily Taiwan Stock Market Technical Analysis

## Overview
This is a Node.js application that provides daily technical analysis notifications for Taiwan ETFs, specifically focusing on 00631L (Taiwan 2x leveraged ETF) and 0050 (Taiwan 50 ETF). The application fetches real-time stock data from Yahoo Finance, calculates technical indicators (RSI and MACD), and can send notifications via LINE messaging platform.

## Current State
- Successfully imported from GitHub and configured for Replit environment
- All dependencies installed and working
- Application tested and functional
- Workflow configured for daily execution
- Deployment configured as a scheduled service

## Project Architecture

### Core Components
- **src/dailyCheck.js** - Main entry point that orchestrates the daily analysis
- **src/api/fetchYahoo.js** - Yahoo Finance API integration for stock data
- **src/indicators/technicalIndicators.js** - RSI and MACD calculation using technicalindicators library
- **src/line/lineNotify.js** - LINE messaging integration for notifications
- **src/utils/timeUtils.js** - Taiwan timezone utilities for date/time calculations
- **netlify/functions/pushLine.js** - Netlify serverless function wrapper

### Technical Stack
- **Runtime**: Node.js 20
- **Dependencies**: 
  - axios (HTTP requests)
  - dotenv (environment variables)
  - technicalindicators (financial indicators)

### Data Sources
- Yahoo Finance API for stock prices and historical data
- Taiwan stock market ETFs: 00631L.TW and 0050.TW

## Recent Changes (2025-09-18)
- Imported GitHub repository to Replit
- Configured Node.js environment
- Installed all project dependencies
- Set up "Daily ETF Checker" workflow for console output
- Configured scheduled deployment target for production
- Verified functionality with successful test runs

## Environment Configuration

### Required Environment Variables (Optional)
- `LINE_ACCESS_TOKEN` - LINE Bot access token for message sending
- `USER_ID` - LINE user ID for message recipient

**Note**: The application works without these variables, it will simply skip LINE notifications and run in analysis-only mode.

### Replit Configuration
- **Workflow**: "Daily ETF Checker" - runs `npm start` command
- **Deployment**: Configured as scheduled service running `node src/dailyCheck.js`
- **Output**: Console-based, displays technical analysis results

## Features
- Daily RSI (Relative Strength Index) calculation with buy/sell signals
- MACD (Moving Average Convergence Divergence) analysis
- Annual return calculation for 0050 ETF as reference
- Taiwan timezone-aware date calculations
- Special alerts for quarter-end, month-end, and weekly analysis
- Investment discipline reminders and psychological guidance

## User Preferences
- Prefers functional, working applications over mock/placeholder data
- Values authentic financial data integration
- Focuses on practical investment analysis tools

## Usage
The application runs automatically via the configured workflow. Manual execution can be done with:
```bash
npm start
```

This displays the daily analysis without sending LINE notifications, making it perfect for testing and review in the Replit environment.