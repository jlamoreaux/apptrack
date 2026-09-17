/**
 * Coverage meter: the one computed number in the app carries the one
 * explainer, and the explainer quotes the real target.
 */

import { render, screen } from "@testing-library/react";
import { CoverageMeter } from "@/components/careerotter/coverage-meter";
import { COVERAGE_TARGET_PER_AREA } from "@/lib/careerotter/coverage";

it("offers a 'How coverage works' disclosure that states the target and the untagged rule", () => {
  render(<CoverageMeter wins={[{ tag: "delivery" }]} />);
  expect(screen.getByText("How coverage works")).toBeInTheDocument();
  expect(
    screen.getByText(`Each area is fully evidenced at ${COVERAGE_TARGET_PER_AREA} wins.`)
  ).toBeInTheDocument();
  expect(screen.getByText(/A win with no area counts toward nothing/)).toBeInTheDocument();
});

it("still leads with the next thing to do", () => {
  render(<CoverageMeter wins={[{ tag: null }, { tag: "craft" }]} />);
  expect(screen.getByText(/1 of your wins has no area yet/)).toBeInTheDocument();
});
