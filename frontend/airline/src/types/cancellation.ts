export interface CancelledFlight {
  id: string;
  flightCode: string;
  airlineName: string;
  airlineCode: string;
  route: string;
  date: string; // DD/MM/YYYY
  passengers: number;
  cost: number;
  revenue: number;
  status: "Active" | "Inactive" | "Pending" | "Processing" | "Completed" | "Failed";
}
