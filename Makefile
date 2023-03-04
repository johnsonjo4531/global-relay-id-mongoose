test_with_deps:
	$(MAKE) -j 2 run_deps parallel_run

parallel_run: 
	$(MAKE) test && $(MAKE) down

run_deps:
	docker compose -p mongoose-relay up --abort-on-container-exit

test:
	npx jest

down:
	docker compose -p mongoose-relay down