const steps = [
  { name: "Step 1", href: "#", status: "complete" },
  { name: "Step 2", href: "#", status: "current" },
  { name: "Step 3", href: "#", status: "upcoming" },
  { name: "Step 4", href: "#", status: "upcoming" },
];

export default function Steps({ currentStep = 1, numberOfSteps = 3 }) {
  return (
    <nav className="flex items-center justify-center my-4" aria-label="Progress">
      <p className="text-sm font-medium hidden sm:block">
        Step {currentStep} of {numberOfSteps}
      </p>
      <ol role="list" className="ml-8 flex items-center space-x-5">
        {new Array(numberOfSteps).fill(null).map((_, i) => (
          <li key={i}>
            {i + 1 < currentStep ? (
              <div className="block h-2.5 w-2.5 rounded-full bg-indigo-600 hover:bg-indigo-900"></div>
            ) : i + 1 === currentStep ? (
              <div
                className="relative flex items-center justify-center"
                aria-current="step"
              >
                <span className="absolute flex h-5 w-5 p-px" aria-hidden="true">
                  <span className="h-full w-full rounded-full bg-indigo-200" />
                </span>
                <span
                  className="relative block h-2.5 w-2.5 rounded-full bg-indigo-600"
                  aria-hidden="true"
                />
              </div>
            ) : (
              <div className="block h-2.5 w-2.5 rounded-full bg-gray-200 hover:bg-gray-400"></div>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
