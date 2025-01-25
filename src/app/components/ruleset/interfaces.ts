export interface Filter {
    attribute: string;
    type: string;
    value: string;
  }
  
  export interface DurationResult {
    averageRuntime: number;
    episodeCount: number;
    duration: number;
  }
  
  export interface RegexRule {
    type: string;
    field?: string;
    pattern?: string;
    value?: string;
  }