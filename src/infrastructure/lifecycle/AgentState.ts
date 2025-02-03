export interface AgentState {
    userId: string;
    agentId: string;
    status: 'active' | 'frozen' | 'starting' | 'stopping' | 'error';
    lastActivity: Date;
    containerId?: string;
    createdAt: Date;
    lastFrozen?: Date;
    lastUnfrozen?: Date;
    errorMessage?: string;
    memoryUsage?: number;
    cpuUsage?: number;
}