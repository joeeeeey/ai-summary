build:
	docker build -t ai-summary-app .

run:
	docker run -p 3000:3000 ai-summary-app

