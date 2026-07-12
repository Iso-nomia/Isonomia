/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import Chip from "@/components/ui/Chip";

it("renders spanish chip", () => {
  (window as any).i18next = { language: "es" };
  render(<Chip chip={{ en: "Both appreciate sci-fi", es: "Ambos disfrutan de la ciencia ficcion" }} />);
  expect(screen.getByText(/Ambos disfrutan/)).toBeInTheDocument();
});
