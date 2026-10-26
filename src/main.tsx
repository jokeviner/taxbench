import { createRoot } from "react-dom/client";
import "./app/globals.css";
import Home from "./app/page";
import "./app/density.css";

createRoot(document.getElementById("root")!).render(<Home />);
