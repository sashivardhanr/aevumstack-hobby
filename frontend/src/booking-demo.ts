for (const demo of document.querySelectorAll<HTMLElement>("[data-booking-demo]")) {
    const controls = demo.querySelector<HTMLElement>("[data-demo-controls]")!;
    const fallback = demo.querySelector<HTMLElement>("[data-demo-fallback]")!;
    const confirm = demo.querySelector<HTMLButtonElement>("[data-demo-confirm]")!;
    const reset = demo.querySelector<HTMLButtonElement>("[data-demo-reset]")!;
    const checkIn = demo.querySelector<HTMLButtonElement>("[data-demo-check-in]")!;
    const entry = demo.querySelector<HTMLElement>("[data-demo-entry]")!;
    const empty = demo.querySelector<HTMLElement>("[data-demo-empty]")!;
    const status = demo.querySelector<HTMLElement>("[data-demo-status]")!;
    const state = demo.querySelector<HTMLElement>("[data-demo-state]")!;
    const serviceOutput = demo.querySelector<HTMLElement>("[data-demo-service]")!;
    const slotOutput = demo.querySelector<HTMLElement>("[data-demo-slot]")!;
    const durationOutput = demo.querySelector<HTMLElement>("[data-demo-duration]")!;

    const selected = (name: "service" | "slot") =>
      controls.querySelector<HTMLInputElement>(`input[name="demo-${name}"]:checked`);

    function clearSimulation(message = "") {
      confirm.disabled = !selected("slot");
      entry.hidden = true;
      empty.hidden = false;
      checkIn.removeAttribute("aria-disabled");
      state.textContent = "Scheduled";
      status.textContent = message;
    }

    controls.addEventListener("change", () => clearSimulation(entry.hidden ? "" : "Selection changed. Simulate again to update the queue."));
    confirm.addEventListener("click", () => {
      const service = selected("service");
      const slot = selected("slot");
      if (!service || !slot) return;
      clearSimulation();
      serviceOutput.textContent = service.dataset.label ?? "";
      slotOutput.textContent = `${slot.value} IST`;
      durationOutput.textContent = `${service.dataset.duration} · Sample appointment`;
      empty.hidden = true;
      entry.hidden = false;
      status.textContent = `Simulation confirmed: ${service.dataset.label}, ${slot.value} IST. Added to the sample queue.`;
    });
    checkIn.addEventListener("click", () => {
      if (entry.hidden || checkIn.getAttribute("aria-disabled") === "true") return;
      state.textContent = "Checked in";
      checkIn.setAttribute("aria-disabled", "true");
      status.textContent = "Sample appointment checked in.";
    });
    reset.addEventListener("click", () => {
      for (const input of controls.querySelectorAll<HTMLInputElement>("input")) input.checked = input.defaultChecked;
      clearSimulation("Demo reset. Choose a sample slot to start again.");
    });

    clearSimulation();
    fallback.hidden = true;
    controls.hidden = false;
  }
