# OpenClaw

OpenClaw is an experimental gateway service for AI agent orchestration. It provides a REST API for running autonomous agents, managing tool execution, and handling asynchronous workflows.

## Overview

OpenClaw runs as a local REST server (typically on `localhost:3003`) that:
- Accepts agent task definitions
- Routes tasks to configured AI models
- Manages tool execution lifecycles
- Handles concurrent agent sessions
- Provides a dead-letter queue for failed operations

## Components

### Gateway Server

The OpenClaw gateway is an Express-based HTTP server that:
1. Authenticates requests via admin token
2. Routes incoming tasks to the agent executor
3. Streams agent responses back via Server-Sent Events (SSE)
4. Manages session state and cleanup

### Agent Executor

The executor runs agent loops with:
- **Tool calling**: The agent can invoke local tools (search, read, write, bash)
- **Human-in-the-loop**: Critical operations pause for user approval
- **Checkpointing**: Agent state is persisted between turns
- **Timeout handling**: Stuck agents are terminated gracefully

### Dead-Letter Queue (DLQ)

Failed operations are routed to a DLQ for review:
- Captures failed tool calls with error context
- Stores rejected modifications with user feedback
- Provides a UI for reviewing and retrying failed operations
- Configurable retry policies per operation type

## Pairing

OpenClaw supports a pairing system where two agent instances collaborate:
- **Primary agent**: Handles user interaction and high-level planning
- **Secondary agent**: Performs specialized subtasks (testing, refactoring, analysis)
- **Shared context**: Both agents share workspace state via the gateway

## Installation Check

SmartCursorX includes OpenClaw installation verification:
- Checks for the OpenClaw binary in expected paths
- Runs a doctor script to diagnose configuration issues
- Provides start/stop controls from the UI

## Status Monitoring

The UI shows real-time OpenClaw status:
- **Gateway status**: Running/stopped with port information
- **Active sessions**: Currently executing agent tasks
- **Log viewer**: Recent OpenClaw log output with filtering

## Configuration

Accessed via **Settings → OpenClaw**:
- Start/stop the gateway server
- View connection details (admin token, port)
- Run diagnostic checks
- Browse recent logs
- Clear session state on reset
